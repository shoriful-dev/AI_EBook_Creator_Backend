const fs = require('fs');
const path = require('path');
const SSLCommerzPayment = require('sslcommerz-lts');
const User = require('../models/User');

// #region agent log
const agentLogPath = path.join(__dirname, '..', '..', 'debug-4b6289.log');
const agentLog = (payload) => {
  const line = JSON.stringify({
    sessionId: '4b6289',
    timestamp: Date.now(),
    ...payload,
  });
  try {
    fs.appendFileSync(agentLogPath, `${line}\n`);
  } catch (_) {}
  fetch('http://127.0.0.1:7909/ingest/de734390-d038-4f3f-845d-2e6358563d5e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b6289' },
    body: line,
  }).catch(() => {});
};
const urlScheme = (u) => {
  if (!u || typeof u !== 'string') return 'missing';
  try {
    return new URL(u).protocol;
  } catch {
    return 'invalid';
  }
};
// #endregion

const initPayment = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    const userId = req.user._id;
    const tran_id = `TRAN_${Date.now()}`;

    const data = {
      total_amount: 500,
      currency: 'BDT',
      tran_id: tran_id,
      success_url: process.env.SUCCESS_URL,
      fail_url: process.env.FAIL_URL,
      cancel_url: process.env.CANCEL_URL,
      ipn_url: process.env.IPN_URL || 'http://localhost:8000/api/payment/ipn',
      shipping_method: 'No',
      product_name: 'AI eBook Creator - 1 Year Pro',
      product_category: 'SaaS',
      product_profile: 'general',
      cus_name: req.user.name,
      cus_email: req.user.email,
      cus_add1: 'Dhaka',
      cus_add2: 'Dhaka',
      cus_city: 'Dhaka',
      cus_state: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: '01711111111',
      cus_fax: '01711111111',
      ship_name: 'Customer Name',
      ship_add1: 'Dhaka',
      ship_add2: 'Dhaka',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postcode: 1000,
      ship_country: 'Bangladesh',
      value_a: userId.toString(),
    };

    const sslcz = new SSLCommerzPayment(
      process.env.SSL_STORE_ID,
      process.env.SSL_STORE_PASSWORD,
      process.env.IS_SANDBOX !== 'true', // live = false if IS_SANDBOX is true
    );

    console.log('--- Initializing Payment ---');
    console.log('Store ID:', process.env.SSL_STORE_ID);
    console.log('Is Sandbox:', process.env.IS_SANDBOX);

    const apiResponse = await sslcz.init(data);

    // Log full response for debugging
    console.log('SSLCommerz API Response:', apiResponse);

    if (apiResponse.status === 'SUCCESS' && apiResponse.GatewayPageURL) {
      // #region agent log
      const gatewayUrl = apiResponse.GatewayPageURL;
      const debugData = {
        gatewayScheme: urlScheme(gatewayUrl),
        successScheme: urlScheme(data.success_url),
        failScheme: urlScheme(data.fail_url),
        cancelScheme: urlScheme(data.cancel_url),
        ipnScheme: urlScheme(data.ipn_url),
        isSandbox: process.env.IS_SANDBOX === 'true',
      };
      agentLog({
        runId: 'post-fix',
        hypothesisId: 'H1-H5',
        location: 'paymentController.js:initPayment',
        message: 'SSLCommerz init success; URL schemes',
        data: debugData,
      });
      // #endregion
      res.send({
        url: gatewayUrl,
        _debug4b6289: debugData,
      });
    } else {
      console.error('Payment initialization failed status:', apiResponse.status);
      console.error('Failure Reason:', apiResponse.failedreason);
      res.status(400).json({
        message: 'Payment initialization failed',
        error: apiResponse.failedreason || 'Unknown error',
      });
    }
  } catch (error) {
    // #region agent log
    agentLog({
      runId: 'post-fix',
      hypothesisId: 'H-crash',
      location: 'paymentController.js:initPayment:catch',
      message: 'initPayment uncaught',
      data: { errName: error?.name, errMessage: error?.message },
    });
    // #endregion
    console.error('initPayment error:', error);
    res.status(500).json({
      message: 'Internal Server Error during payment',
      error: error.message,
    });
  }
};

const paymentSuccess = async (req, res) => {
  const { val_id, tran_id, value_a } = req.body;
  const userId = value_a;

  const sslcz = new SSLCommerzPayment(
    process.env.SSL_STORE_ID,
    process.env.SSL_STORE_PASSWORD,
    process.env.IS_SANDBOX !== 'true' // live = false if IS_SANDBOX is true
  );

  try {
    const validateResponse = await sslcz.validate({ val_id });
    if (validateResponse.status === 'VALID') {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      await User.findByIdAndUpdate(userId, {
        isPro: true,
        planExpiry: expiryDate,
      });

      res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment=success`);
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment=fail`);
    }
  } catch (error) {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment=error`);
  }
};

const paymentFail = (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment=fail`);
};

const paymentCancel = (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment=cancel`);
};

const paymentIPN = async (req, res) => {
  console.log('--- Received IPN ---', req.body);
  const { val_id, status } = req.body;

  if (status === 'VALID' || status === 'AUTHENTICATED') {
    // Usually you would double check validation here too
    // But basic IPN handling for sandbox is good
    res.status(200).send('IPN Received');
  } else {
    res.status(400).send('Invalid IPN');
  }
};

module.exports = {
  initPayment,
  paymentSuccess,
  paymentFail,
  paymentCancel,
  paymentIPN,
};

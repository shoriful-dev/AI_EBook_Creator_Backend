const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper: Generate JWT Token
const generateToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// @desc    Register new user
exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password });
    if (user) {
      console.log('User registered successfully:', email);
      return res.status(201).json({
        message: 'User registered successfully',
        token: generateToken(user._id),
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isPro: user.isPro,
        }
      });
    } else {
      console.error('User registration failed - Invalid data');
      return res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ message: error.message || 'Server error during registration' });
  }
};

// @desc    Login user
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');
    if (user && (await user.matchPassword(password))) {
      console.log('Login successful:', email);
      return res.json({
        message: 'Login successful',
        token: generateToken(user._id),
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isPro: user.isPro,
        }
      });
    } else {
      console.warn('Login failed - Invalid credentials:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ message: error.message || 'Server error during login' });
  }
};

// @desc    Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isPro: user.isPro,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.name = req.body.name || user.name;
      const updatedUser = await user.save();
      return res.json({
        message: 'Profile updated successfully',
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        isPro: updatedUser.isPro,
      });
    } else {
      return res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user avatar
exports.updateUserAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      if (req.file) {
        user.avatar = `uploads/${req.file.filename}`;
      } else {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const updatedUser = await user.save();
      return res.json({
        message: 'Avatar updated successfully',
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        isPro: updatedUser.isPro,
      });
    } else {
      return res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

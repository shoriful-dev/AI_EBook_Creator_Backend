const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// @desc    Generate a Book Outline
// @route   POST /api/ai/generate-outline
// @access  Private
const generateOutline = async (req, res) => {
  try {
    const { topic, style, numChapters, description } = req.body;
    if (!topic) {
      return res.status(400).json({ message: 'Topic is required' });
    }

    const prompt = `You are an expert book outline generator. Create a comprehensive book outline based on the following requirements:
    Topic: "${topic}"
    ${description ? `Description: ${description}` : ''}
    Writing Style: ${style}
    Number of Chapters: ${numChapters || 5}

    Requirements:
    1. Generate exactly ${numChapters || 5} chapters
    2. Each chapter should be clear, engaging, and follow a logical progression
    3. Each chapter description should be 2-3 sentences explaining what the chapter will cover
    4. Ensure chapters build upon each other coherently
    5. Match the "${style}" writing style in your titles and descriptions
    
    Output Format:
    Return Only a valid JSON array with no additional text, markdown, or formatting. Each object must have exactly two keys: "title" and "description".

    Example structure:
    [
      {
        "title": "Chapter 1: Introduction to the Topic",
        "description": "This chapter provides an overview of the topic, setting the stage for deeper exploration in subsequent chapters."
      },
      {
        "title": "Chapter 2: Understanding Key Concepts and Core Principles",
        "description": "This chapter delves into the fundamental concepts necessary to grasp the subject matter effectively."
      }
    ]

    Now, generate the book outline based on the provided topic and requirements.`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const text = response.choices[0].message.content;

    // Find and extract the JSON array from the response text
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');

    if (startIndex === -1 || endIndex === -1) {
      return res
        .status(500)
        .json({ message: 'Failed to parse AI response, no JSON array found' });
    }

    const jsonString = text.substring(startIndex, endIndex + 1);

    // Validate if the response is a valid JSON
    try {
      const outline = JSON.parse(jsonString);
      return res.status(200).json({ outline });
    } catch (error) {
      res.status(500).json({ message: 'Failed to parse AI response as JSON' });
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: 'Server error during AI outline generation' });
  }
};

// @desc    Generate Content for a Chapter
// @route   POST /api/ai/generate-chapter-content
// @access  Private
const generateChapterContent = async (req, res) => {
  try {
    const { chapterTitle, chapterDescription, style } = req.body;
    if (!chapterTitle) {
      return res.status(400).json({ message: 'Chapter title is required' });
    }

    const prompt = `You are an expert content writer specializing in creating engaging, well-structured book chapters. Generate comprehensive chapter content based on the following information:

Chapter Title: "${chapterTitle}"
${chapterDescription ? `Chapter Description: ${chapterDescription}` : ''}
Writing Style: ${style}

Requirements:
1. Write a substantial chapter (approximately 1500-2000 words)
2. Follow a clear structure: introduction, main content sections, and conclusion
3. Use the "${style}" writing style throughout the content
4. Ensure smooth transitions between sections
5. Include practical examples, explanations, or insights relevant to the topic
6. Make the content engaging and informative for readers
7. Use proper formatting with paragraphs and section breaks
8. Write in a professional, authoritative tone that matches the book's overall style

Content Structure:
- Introduction: Hook the reader and introduce the chapter's main theme
- Main Body: Develop the topic with 3-5 well-organized sections
- Conclusion: Summarize key points and provide transition to next chapter

Output Format:
Return only the chapter content as plain text without any JSON formatting, markdown, or additional commentary. The content should be ready to be directly inserted into a book chapter.

Now, generate the complete chapter content based on the provided title and requirements.`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;

    return res.status(200).json({ content });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: 'Server error during AI chapter content generation' });
  }
};

module.exports = {
  generateOutline,
  generateChapterContent,
};

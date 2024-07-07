const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

app.use(cors());
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB 연결 문자열을 환경 변수로 이동하는 것이 좋습니다.
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'doctorchat',
});

// 스키마 정의
const userInfoSchema = new mongoose.Schema({
  email: String,
  user_name: String,
  license_number: String
});

const chatHistorySchema = new mongoose.Schema({
  email: String,
  chat_date: Date,
  chat_list: [{
    sender: String,
    date: Date,
    message: String
  }]
});

// 모델 생성
const UserInfo = mongoose.model('user_info', userInfoSchema);
const ChatHistory = mongoose.model('chat_history', chatHistorySchema);

// API 엔드포인트

// 1. 사용자 정보 등록
app.post('/api/regist_user_info', async (req, res) => {
  try {
    const { email, user_name, license_number = "" } = req.body;

    if (!email || !user_name) {
      return res.status(400).json({ error: "Email and user_name are required" });
    }

    const updateData = {
      user_name,
      license_number
    };

    const options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    };

    const user = await UserInfo.findOneAndUpdate(
      { email },
      updateData,
      options
    );

    if (user.isNew) {
      res.status(201).json({ message: "User registered successfully", user });
    } else {
      res.status(200).json({ message: "User information updated successfully", user });
    }
  } catch (error) {
    console.error("Error in user registration/update:", error);
    if (error.code === 11000) {
      // This handles the case where a unique index other than email causes a conflict
      return res.status(409).json({ error: "User with this information already exists" });
    }
    res.status(500).json({ error: "Error in user registration/update", details: error.message });
  }
});

// 2. 라이센스 확인
app.get('/api/check-license', async (req, res) => {
  try {
    const user = await UserInfo.findOne({ email: req.query.email });
    res.json({ license_number: user ? user.license_number || "" : "" });
  } catch (error) {
    res.status(500).json({ error: "Error checking license" });
  }
});

// update-chat API (저장 및 업데이트 기능 통합)
app.put('/api/update-chat', async (req, res) => {
  try {
    console.log("Received request body:", JSON.stringify(req.body, null, 2));

    const { email, chat_date, chat_list } = req.body;

    if (!email || !chat_date || !chat_list || !Array.isArray(chat_list)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const parsedChatDate = new Date(chat_date);
    console.log("Parsed chat_date:", parsedChatDate);

    if (isNaN(parsedChatDate.getTime())) {
      return res.status(400).json({ error: "Invalid chat_date format" });
    }

    const processedChatList = chat_list.map(chat => ({
      ...chat,
      date: chat.date ? new Date(chat.date) : new Date()
    }));

    console.log("Processed chat_list:", JSON.stringify(processedChatList, null, 2));

    // 문서를 찾아 업데이트하거나, 없으면 새로 생성
    const result = await ChatHistory.findOneAndUpdate(
      { email, chat_date: parsedChatDate },
      { 
        $setOnInsert: { email, chat_date: parsedChatDate },
        $push: { chat_list: { $each: processedChatList } }
      },
      { 
        upsert: true, 
        new: true, 
        setDefaultsOnInsert: true 
      }
    );

    console.log("Operation result:", result);

    if (result.isNew) {
      res.status(201).json({ message: "New chat history created", result });
    } else {
      res.json({ message: "Chat history updated", result });
    }
  } catch (error) {
    console.error("Error updating/creating chat:", error);
    res.status(500).json({ error: "Error updating/creating chat", details: error.message });
  }
});

app.get('/api/chat-history', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const chatHistory = await ChatHistory.find({ email })
      .sort({ chat_date: -1 }) // chat_date를 기준으로 내림차순 정렬
      .exec();

    if (chatHistory.length === 0) {
      return res.status(404).json({ message: "No chat history found for this email" });
    }

    res.json(chatHistory);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: "Error fetching chat history", details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get('/api/check-userinfo', async (req, res) => {
  try {
    const user = await UserInfo.findOne({ email: req.query.email });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Error checking license" });
  }
});
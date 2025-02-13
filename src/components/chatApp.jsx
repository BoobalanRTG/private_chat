import React, { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import {
  TextField,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  Box,
  IconButton,
  AppBar,
  Toolbar,
  CircularProgress,
} from "@mui/material";
import { AttachFile, Mic, Send, Close, Stop } from "@mui/icons-material";

const MQTT_BROKER_URL = "ws://broker.hivemq.com:8000/mqtt";
const CHATROOM_TOPIC = "chatroom";
const SUB_TOPIC = "chatroom/Boobalan";

const MqttChat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const mqttClient = mqtt.connect(MQTT_BROKER_URL);

    mqttClient.on("connect", () => {
      console.log("Connected to MQTT Broker");
      setIsConnected(true);
      mqttClient.subscribe(`${CHATROOM_TOPIC}/#`);
    });

    mqttClient.on("message", (topic, message) => {
      const sender = topic.split("/")[1] || "Unknown";
      if (sender !== "Boobalan") {
        const receivedMessage = message.toString();
        let content = receivedMessage;

        if (
          receivedMessage.startsWith("data:image") ||
          receivedMessage.startsWith("data:audio")
        ) {
          content = receivedMessage;
        }

        setMessages((prevMessages) => [
          ...prevMessages,
          { sender, content, timestamp: new Date().toLocaleTimeString() },
        ]);
      }
    });

    setClient(mqttClient);
    return () => {
      mqttClient.end();
    };
  }, []);

  const handleSendMessage = (content) => {
    if (client && isConnected && content) {
      client.publish(SUB_TOPIC, content);
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "Me", content, timestamp: new Date().toLocaleTimeString() },
      ]);
      setMessage("");
      setSelectedFile(null);
      setAudioBlob(null);
      setRecording(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile(reader.result);
    };

    if (file.type.startsWith("image") || file.type.startsWith("audio")) {
      reader.readAsDataURL(file);
    }
  };

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Your browser does not support audio recording");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    let chunks = [];

    recorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };

    recorder.onstop = () => {
      const audioBlob = new Blob(chunks, { type: "audio/mp3" });
      const reader = new FileReader();

      reader.onload = () => {
        setAudioBlob(reader.result);
      };

      reader.readAsDataURL(audioBlob);
    };

    setMediaRecorder(recorder);
    setRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    recorder.start();
  };

  const handleStopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      clearInterval(timerRef.current);
      setRecording(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar className="rounded-lg" position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            MQTT Chat
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          padding: 2,
          backgroundColor: "#f5f5f5",
        }}
      >
        <List>
          {messages.map((msg, index) => (
            <ListItem
              key={index}
              sx={{
                display: "flex",
                justifyContent: msg.sender === "Me" ? "flex-end" : "flex-start",
              }}
            >
              <Box
                sx={{
                  backgroundColor: msg.sender === "Me" ? "#0078ff" : "#e0e0e0",
                  color: msg.sender === "Me" ? "#fff" : "#000",
                  padding: "10px",
                  borderRadius: "10px",
                  maxWidth: "70%",
                  textAlign: "left",
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                  {msg.sender}
                </Typography>

                {msg.content.startsWith("data:image") ? (
                  <img
                    src={msg.content}
                    alt="Received"
                  />
                ) : msg.content.startsWith("data:audio") ? (
                  <audio controls>
                    <source src={msg.content} type="audio/mp3" />
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <Typography variant="body1">{msg.content}</Typography>
                )}

                <Typography
                  variant="caption"
                  sx={{ opacity: 0.7, display: "block", textAlign: "right" }}
                >
                  {msg.timestamp}
                </Typography>
              </Box>
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Box>

      {/* Preview Section */}
      {(selectedFile || audioBlob) && (
        <Box
          sx={{ padding: 2, textAlign: "center", backgroundColor: "#e0e0e0" }}
        >
          <Typography variant="subtitle1">Preview:</Typography>
          {selectedFile?.startsWith("data:image") ? (
            <img
              src={selectedFile}
              alt="Preview"
              style={{ maxWidth: "50%", borderRadius: "5px" }}
            />
          ) : (
            <audio controls>
              <source src={selectedFile || audioBlob} type="audio/mp3" />
              Your browser does not support the audio element.
            </audio>
          )}
          <IconButton onClick={() => setSelectedFile(null)}>
            <Close />
          </IconButton>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleSendMessage(selectedFile || audioBlob)}
          >
            Send
          </Button>
        </Box>
      )}

      {/* Input Section */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          padding: 2,
          backgroundColor: "#fff",
          borderRadius: "20px",
        }}
      >
        <IconButton sx={{ marginX:2,boxShadow:2}} component="label">
          <AttachFile />
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </IconButton>

        <TextField
          label="Type a message..."
          variant="outlined"
          fullWidth
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        {recording && (
          <Typography variant="body2" sx={{marginLeft:2, marginRight: 1, color: "red" }}>
            {recordingTime}s
          </Typography>
        )}

        <IconButton sx={{boxShadow:1, marginX:2}}
          onClick={recording ? handleStopRecording : handleStartRecording}
          color="primary"
        >
          {recording ? <Stop sx={{ color: "red" }} /> : <Mic />}
        </IconButton>

        <Button
          variant="contained"
          color="primary"
          onClick={() => handleSendMessage(message)}
          disabled={!message.trim()}
        >
          <Send />
        </Button>
      </Box>
    </Box>
  );
};

export default MqttChat;

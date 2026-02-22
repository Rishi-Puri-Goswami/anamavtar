// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/anam/session", async (req, res) => {
  try {
    
    const apiKey = process.env.ANAM_API_KEY;
    if (!apiKey) {
      throw new Error("ANAM_API_KEY is missing from environment variables.");
    }



    const personaConfig = {
      avatarId: "ccf00c0e-7302-455b-ace2-057e0cf58127",
      voiceId: "dd0caf83-c862-4c90-b12a-969baedca3d0",
      llmId: "0934d97d-0c3a-4f33-91b0-5e136a0ef466",
      disableInitialGreeting: true,
      enableTranscription: true,
      transcriptionEvents: [
        "user_transcript",
        "assistant_transcript",
        "user_speech_started",
        "user_speech_ended",
        "assistant_speech_started",
        "assistant_speech_ended"
      ],
      systemPrompt: `
        You are a professional technical interviewer. Never mention that you are an AI.
        
        IMPORTANT RULES:
        1. Ask ONE question at a time and wait for the response.
        2. Provide brief feedback (1-2 sentences) before moving to the next question.
        3. Start easy, increase difficulty.
        4. Be professional.
        5. After 5 questions, summarize and provide a score.
      `
    };

    const response = await fetch("https://api.anam.ai/v1/auth/session-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ personaConfig }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anam API responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error("Session creation error:", err.message);
    res.status(500).json({ error: "Failed to initialize interview session." });
  }
});

app.listen(5000, () => console.log("Backend running on port 5000"));
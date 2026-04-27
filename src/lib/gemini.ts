import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateMeetingMinutes(transcript: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert meeting minutes assistant. 
      Generate professional meeting minutes from the following transcript.
      
      Format the output with the following sections:
      - Title of Key Discussion
      - Summary: A concise overview of the meeting (2-3 paragraphs)
      - Key Takeaways: Bulleted list of the most important points
      - Action Items: Bulleted list of assignments, who's responsible, and deadlines (if mentioned)
      - Decisions Made: Bulleted list of final decisions
      - Next Steps: Brief conclude on what happens next
      
      Transcript:
      ${transcript}`,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate meeting minutes. Please try again later.");
  }
}

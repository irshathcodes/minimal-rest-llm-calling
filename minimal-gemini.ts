import {createInterface} from "node:readline/promises";

type Part = {
  text: string;
};

type Content = {
  role: "user" | "model";
  parts: Part[];
};

class GenAI {
  model: string;
  apiKey: string;
  messages: Content[] = [];

  constructor({model, apiKey}: {model: string; apiKey: string}) {
    this.model = model;
    this.apiKey = apiKey;
  }

  async generate({prompt}: {prompt: string}) {
    this.messages.push({role: "user", parts: [{text: prompt}]});

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          contents: this.messages,
        }),
      },
    );

    const data: any = await res.json();

    if (!res.ok) {
      new Error(data.error);
    }

    const llmText: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof llmText !== "string") {
      throw new Error(
        `Error while parsing the response: Expected string got ${llmText}`,
      );
    }

    this.messages.push({role: "model", parts: [{text: llmText}]});

    return llmText;
  }
}

const ai = new GenAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GOOGLE_LLM_API_KEY!,
});

const rl = createInterface({input: process.stdin, output: process.stdout});

while (true) {
  const prompt = await rl.question("User: ");

  if (prompt === "exit") {
    break;
  }

  const result = await ai.generate({prompt});
  console.log("AI: ", result);
}

rl.close();

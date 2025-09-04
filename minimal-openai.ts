import {createInterface} from "node:readline/promises";

type Content = string;

type Message = {
  role: "user" | "assistant";
  content: Content;
};

class GenAI {
  model: string;
  apiKey: string;
  messages: Message[] = [];

  constructor({model, apiKey}: {model: string; apiKey: string}) {
    this.model = model;
    this.apiKey = apiKey;
  }

  async generate({prompt}: {prompt: string}) {
    this.messages.push({role: "user", content: prompt});

    const res = await fetch(`https://api.openai.com/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.messages,
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      throw new Error(data);
    }

    const llmResponse: Message = data.choices[0].message;
    this.messages.push({role: llmResponse.role, content: llmResponse.content});

    return llmResponse.content;
  }

  async streamGenerate({
    prompt,
    onStream,
    onComplete,
  }: {
    prompt: string;
    onStream: (streamingContent: string) => void;
    onComplete: (fullContent: string) => void;
  }) {
    this.messages.push({role: "user", content: prompt});

    const res = await fetch(`https://api.openai.com/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        stream: true,
        model: this.model,
        messages: this.messages,
      }),
    });

    if (!res.body) {
      throw new Error("Streaming failed: `res.body` is null");
    }

    const textDecoder = new TextDecoder();

    let currentObj = "";
    let fullContent = "";

    for await (let chunk of res.body) {
      const decodedChunk = textDecoder.decode(chunk, {stream: true});
      const lines = decodedChunk.split("\n");

      for (let line of lines) {
        if (line.startsWith("data: ")) {
          if (currentObj) {
            const json = JSON.parse(currentObj);
            const llmContent = json?.choices?.[0]?.delta?.content;
            fullContent += llmContent;
            onStream(llmContent);
          }

          currentObj = line.slice(6);
        } else {
          currentObj += line;
        }
      }
    }

    onComplete(fullContent);
    this.messages.push({role: "assistant", content: fullContent});
  }
}

const ai = new GenAI({
  model: "gpt-5",
  apiKey: process.env.OPENAI_API_KEY!,
});

async function runGenerate() {
  const rl = createInterface({input: process.stdin, output: process.stdout});

  while (true) {
    const prompt = await rl.question("User: ");

    if (prompt === "exit") {
      break;
    }

    const response = await ai.generate({prompt});

    console.log("LLM: ", response);
  }

  rl.close();
}

async function streamGenerate() {
  const rl = createInterface({input: process.stdin, output: process.stdout});
  console.log("Ask anything!");

  while (true) {
    const prompt = await rl.question("User: ");

    if (prompt === "exit") {
      rl.write("Bye! \n");
      rl.close();
      break;
    }

    rl.write("Loading...\n");
    await ai.streamGenerate({
      prompt,
      onStream: (streamText) => {
        rl.write(streamText);
      },
      onComplete: () => {
        rl.write("\n");
      },
    });
  }
}

streamGenerate();

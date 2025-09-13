import { createInterface } from "node:readline/promises";
import z from "zod";

type Message = {
  role: "user" | "assistant" | "tool";
  content?: string | null | undefined;
  tool_calls?:
    | {
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }[]
    | undefined;
  tool_call_id?: string;
};

const temperatureToolReqSchema = z.object({
  location: z.string().describe("city, eg: London or country, eg: India"),
  units: z
    .enum(["celsius", "fahrenheit"])
    .describe("Unit the temperature will be returned in."),
});

class GenAI {
  model: string;
  apiKey: string;
  messages: Message[] = [];
  tools = [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Retrieves current weather for a given location",
        parameters: z.toJSONSchema(temperatureToolReqSchema),
      },
      strict: true,
    },
  ];

  constructor({ model, apiKey }: { model: string; apiKey: string }) {
    this.model = model;
    this.apiKey = apiKey;
  }

  async execute(): Promise<string> {
    const llmRes = await fetch(`https://api.openai.com/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.messages,
        tools: this.tools,
        tool_choice: "auto",
      }),
    });

    const data: any = await llmRes.json();

    if (!llmRes.ok) {
      throw new Error(JSON.stringify(data));
    }

    const llmResult: Message = data.choices[0].message;
    const hasToolCall =
      Array.isArray(llmResult.tool_calls) && llmResult.tool_calls.length;

    this.messages.push({
      role: llmResult.role,
      content: llmResult.content,
      tool_calls: hasToolCall ? llmResult.tool_calls : undefined,
    });

    if (hasToolCall) {
      for (let tool of llmResult.tool_calls!) {
        if (tool.function.name === "get_weather") {
          const toolArgs = temperatureToolReqSchema.parse(
            JSON.parse(tool.function.arguments),
          );
          const coordinatesFindRes = await fetch(
            ` https://geocoding-api.open-meteo.com/v1/search?name=${toolArgs.location}`,
          );

          const data: any = await coordinatesFindRes.json();

          if (!coordinatesFindRes.ok) {
            throw new Error(JSON.stringify(data));
          }

          const location = data.results[0];
          const url = new URL("https://api.open-meteo.com/v1/forecast");
          url.searchParams.set("latitude", location.latitude);
          url.searchParams.set("longitude", location.longitude);
          url.searchParams.set("timezone", location.timezone);
          url.searchParams.set("hourly", "temperature_2m");
          url.searchParams.set("current", "temperature_2m");
          url.searchParams.set("forecast_days", "1");
          const weatherApiRes = await fetch(url.toString());
          const weatherResult: any = await weatherApiRes.json();

          if (!weatherApiRes.ok) {
            throw new Error(JSON.stringify(weatherResult));
          }

          const temperature = weatherResult.current.temperature_2m;

          this.messages.push({
            role: "tool",
            tool_call_id: tool.id,
            content: JSON.stringify({
              temperature,
            }),
          });

          const llmToolResponse = await this.execute();
          return llmToolResponse;
        }
      }
    }

    return llmResult.content!;
  }

  async generate({ prompt }: { prompt: string }) {
    this.messages.push({ role: "user", content: prompt });
    const result = await this.execute();
    return result;
  }
}

const ai = new GenAI({
  model: "gpt-5",
  apiKey: process.env.OPENAI_API_KEY!,
});

async function runGenerate() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    const prompt = await rl.question("User: ");

    if (prompt === "exit") {
      break;
    }

    const response = await ai.generate({ prompt });

    console.log("LLM: ", response);
  }

  rl.close();
}

runGenerate();

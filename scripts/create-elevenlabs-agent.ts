import { config } from "dotenv";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { AGENT_FIRST_MESSAGE, AGENT_PROMPT } from "../src/lib/agent-prompt";
import { TOOL_NAMES } from "../src/lib/types";
import { TOOL_PARAM_SCHEMA } from "../src/lib/demo";

config({ path: ".env.local" });
config({ path: ".env" });

type ClientTool = {
  type: "client";
  name: string;
  description: string;
  expectsResponse: boolean;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

function clientTools(): ClientTool[] {
  return TOOL_NAMES.map((name) => {
    const spec = TOOL_PARAM_SCHEMA[name];
    const required =
      name === "create_claim"
        ? ["customer_id", "policy_id"]
        : name === "get_customer" || name === "get_policy"
          ? []
          : ["claim_id"];
    return {
      type: "client",
      name,
      description: spec.description,
      expectsResponse: true,
      parameters: {
        type: "object",
        properties: spec.properties as Record<string, unknown>,
        required,
      },
    };
  });
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log(`
ELEVENLABS_API_KEY is not set.

The app still ships schema, tools, APIs, dashboard, and seeded claims.
Voice will not connect until you:

  1. Copy .env.example to .env.local
  2. Add ELEVENLABS_API_KEY
  3. Re-run: npm run agent:create
  4. Put the printed agent id into ELEVENLABS_AGENT_ID (and NEXT_PUBLIC_ELEVENLABS_AGENT_ID)
`);
    process.exit(0);
  }

  const client = new ElevenLabsClient({ apiKey });
  const agent = await client.conversationalAi.agents.create({
    name: "Forward 2026 AI Claims Agent",
    tags: ["forward-2026", "motor-claims", "prototype"],
    conversationConfig: {
      tts: {
        voiceId: "JBFqnCBsd6RMkjVDRZzb",
        modelId: "eleven_flash_v2",
      },
      agent: {
        firstMessage: AGENT_FIRST_MESSAGE,
        language: "en",
        prompt: {
          prompt: AGENT_PROMPT,
          llm: "gemini-2.0-flash",
          temperature: 0.3,
          // Narrowest fix: SDK expects PromptAgentApiModelOutputToolsItem[];
          // runtime shape unchanged, cast at boundary only.
          tools: clientTools() as unknown as never[],
        },
      },
    },
  });

  const id =
    (agent as { agentId?: string }).agentId ??
    (agent as { agent_id?: string }).agent_id;

  console.log("Created ElevenLabs agent.");
  console.log(`Agent ID: ${id}`);
  console.log("Set these in .env.local:");
  console.log(`  ELEVENLABS_AGENT_ID=${id}`);
  console.log(`  NEXT_PUBLIC_ELEVENLABS_AGENT_ID=${id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

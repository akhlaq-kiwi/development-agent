import type { AgentRunRequest } from "../types.js";

export function buildPrompt(req: AgentRunRequest): string {
  const { workItem, verifyErrors } = req;
  let prompt = `Resolve the ${workItem.provider} work item ${workItem.id}.

Title: ${workItem.title}

Description:
${workItem.body}`;

  if (verifyErrors) {
    prompt += `

ATTENTION: A previous attempt to compile the project or run tests failed with the following errors. You MUST resolve these issues:

${verifyErrors}`;
  }

  prompt += `

Instructions:
1. Understand the issue and identify the files that need to be changed or created.
2. CRITICAL: You must implement all changes and write all new files directly inside the current working directory (the project workspace). Do not create or use folders outside of this project directory.
3. Clean up any temporary files you created during the process.`;

  return prompt;
}

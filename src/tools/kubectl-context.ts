import { KubernetesManager } from "../types.js";
import { execFileSync } from "child_process";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getSpawnMaxBuffer } from "../config/max-buffer.js";

export const kubectlContextSchema = {
  name: "kubectl_context",
  description:
    "List available Kubernetes contexts",
  inputSchema: {
    type: "object",
    properties: {
      showCurrent: {
        type: "boolean",
        description:
          "When listing contexts, highlight which one is currently active",
        default: true,
      },
      detailed: {
        type: "boolean",
        description: "Include detailed information about the context",
        default: false,
      },
      output: {
        type: "string",
        enum: ["json", "yaml", "name", "custom"],
        description: "Output format",
        default: "json",
      },
    },
    required: [],
  },
} as const;

export async function kubectlContext(
  k8sManager: KubernetesManager,
  input: {
    showCurrent?: boolean;
    detailed?: boolean;
    output?: string;
  }
) {
  try {
    const { output = "json" } = input;
    const showCurrent = input.showCurrent !== false; // Default to true if not specified
    const detailed = input.detailed === true; // Default to false if not specified

    const command = "kubectl";
    
    // Build command to list contexts
    let listArgs = ["config", "get-contexts"];

    if (output === "name") {
      listArgs.push("-o", "name");
      
      const result = execFileSync(command, listArgs, {
        encoding: "utf8",
        maxBuffer: getSpawnMaxBuffer(),
        env: { ...process.env, KUBECONFIG: process.env.KUBECONFIG },
      });
      
      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } else {
      // For custom or JSON output, format it ourselves
      const rawResult = execFileSync(command, listArgs, {
        encoding: "utf8",
        maxBuffer: getSpawnMaxBuffer(),
        env: { ...process.env, KUBECONFIG: process.env.KUBECONFIG },
      });

      // Parse the tabular output from kubectl
      const lines = rawResult.trim().split("\n");
      const headers = lines[0].trim().split(/\s+/);
      const currentIndex = headers.indexOf("CURRENT");
      const nameIndex = headers.indexOf("NAME");
      const clusterIndex = headers.indexOf("CLUSTER");
      const authInfoIndex = headers.indexOf("AUTHINFO");
      const namespaceIndex = headers.indexOf("NAMESPACE");

      const contexts = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].trim().split(/\s+/);
        const isCurrent = columns[currentIndex]?.trim() === "*";

        contexts.push({
          name: columns[nameIndex]?.trim(),
          cluster: columns[clusterIndex]?.trim(),
          user: columns[authInfoIndex]?.trim(),
          namespace: columns[namespaceIndex]?.trim() || "default",
          isCurrent: isCurrent,
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ contexts }, null, 2),
          },
        ],
      };
    }
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list kubectl contexts: ${error.message}`
    );
  }
}

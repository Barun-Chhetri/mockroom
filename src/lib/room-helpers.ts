export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'java'

export const LANGUAGE_STARTERS: Record<SupportedLanguage, string> = {
  typescript: `/**
 * MockRoom Technical Interview
 * Language: TypeScript
 */

function solution(input: string[]): any {
  // Your implementation here
  return null;
}

console.log('Result:', solution(['test']));
`,
  javascript: `/**
 * MockRoom Technical Interview
 * Language: JavaScript
 */

function solution(input) {
  // Your implementation here
  return null;
}

console.log('Result:', solution(['test']));
`,
  python: `# MockRoom Technical Interview
# Language: Python

def solution(data: list):
    # Your implementation here
    return None

if __name__ == "__main__":
    print("Result:", solution(["test"]))
`,
  java: `// MockRoom Technical Interview
// Language: Java

public class Solution {
    public static void main(String[] args) {
        System.out.println("Result: " + solution(args));
    }

    public static Object solution(String[] args) {
        // Your implementation here
        return null;
    }
}
`,
}

export function generateInviteCode(length = 8): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

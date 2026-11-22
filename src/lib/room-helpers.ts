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

/**
 * Extracts a candidate invite code from either a raw code string
 * or a full invite URL (e.g. https://mockroom.app.space/join/ABC12345).
 */
export function parseInviteCode(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // 1. Match /join/<code...> anywhere in the URL or path
  const joinMatch = trimmed.match(/(?:\/|^)join\/([A-Za-z0-9_-]+)/i)
  if (joinMatch && joinMatch[1]) {
    return joinMatch[1].trim()
  }

  // 2. If it's a URL or path with a trailing segment
  if (trimmed.includes('/') || trimmed.startsWith('http')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
      const segments = url.pathname.split('/').filter(Boolean)
      const last = segments[segments.length - 1]
      if (last && /^[A-Za-z0-9_-]{4,32}$/.test(last)) {
        return last.trim()
      }
    } catch {
      // Fall through to raw match
    }
  }

  // 3. Raw invite code (alphanumeric or hyphen/underscore, 4-32 characters)
  const codeMatch = trimmed.match(/^[A-Za-z0-9_-]{4,32}$/)
  if (codeMatch) {
    return codeMatch[0].trim()
  }

  return null
}

import readline from 'node:readline/promises';

export async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export async function confirm(question: string): Promise<boolean> {
  const a = (await ask(`${question} [s/N] `)).toLowerCase();
  return a === 's' || a === 'si' || a === 'sí' || a === 'y' || a === 'yes';
}

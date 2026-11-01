/**
 * Reads a password from stdin. On a terminal the input is hidden and asked
 * twice; otherwise (piped from a password manager) the first line is used.
 * Never from argv or the environment: those leak to shell history, `ps` and
 * /proc/<pid>/environ.
 */
export async function readPassword(
  stdin: NodeJS.ReadStream = process.stdin,
  out: NodeJS.WriteStream = process.stderr,
): Promise<string> {
  if (!stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8').split(/\r?\n/)[0] ?? '';
  }
  const first = await promptHidden('Password: ', stdin, out);
  const second = await promptHidden('Repeat it: ', stdin, out);
  if (first !== second) {
    throw new Error('The passwords do not match.');
  }
  return first;
}

function promptHidden(
  question: string,
  stdin: NodeJS.ReadStream,
  out: NodeJS.WriteStream,
): Promise<string> {
  return new Promise((resolve, reject) => {
    out.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const done = (err?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      out.write('\n');
      if (err) reject(err);
      else resolve(value);
    };
    const onData = (data: string) => {
      for (const ch of data) {
        if (ch === '\r' || ch === '\n') return done();
        if (ch === '\u0003') return done(new Error('Cancelled.'));
        if (ch === '\u007f' || ch === '\b')
          value = [...value].slice(0, -1).join('');
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

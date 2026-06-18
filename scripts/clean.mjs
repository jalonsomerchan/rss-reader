import { rm } from 'node:fs/promises';

const paths = ['dist', '.astro'];

await Promise.all(
  paths.map((path) =>
    rm(path, {
      recursive: true,
      force: true,
    })
  )
);

console.log('Cleaned build artifacts.');

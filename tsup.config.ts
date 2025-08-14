import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: false,
  external: [
    '@nestjs/common',
    '@nestjs/core', 
    'sequelize',
    'sequelize-typescript'
  ],
  tsconfig: './tsconfig.json'
});
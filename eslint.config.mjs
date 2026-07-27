import { FlatCompat } from '@eslint/eslintrc';

// next lint 는 Next 16에서 사라지므로 처음부터 ESLint CLI + flat config 로 간다.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'legacy/**',
      'monitor-redesign/**',
      'public/**',
      // Next.js가 생성하는 파일이라 우리가 형태를 바꿀 수 없다
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Prisma 이관 지점(TODO 스텁)은 시그니처를 최종형으로 두고 인자를 아직 쓰지 않는다.
      // 밑줄로 시작하는 인자는 "의도적으로 아직 안 씀"이라는 표시로 취급한다.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];

export default config;

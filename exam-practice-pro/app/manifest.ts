import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ExamPro — Govt Mocks, IT Certifications & Daily Streak',
    short_name: 'ExamPro',
    description: 'Practice exams with a daily five-question streak in English, Hindi and Bangla.',
    start_url: '/?source=pwa',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#090d16',
    theme_color: '#4f46e5',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/pwa-icon?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Daily 5-Question Streak', short_name: 'Daily Quiz', url: '/?daily=1' },
      { name: 'Government Mocks', short_name: 'Govt Mocks', url: '/india-mocks' },
      { name: 'Start Learning Ebooks', short_name: 'Ebooks', url: '/certifications?tab=start-learning' },
      { name: 'Dashboard', short_name: 'Dashboard', url: '/dashboard' },
    ],
  };
}

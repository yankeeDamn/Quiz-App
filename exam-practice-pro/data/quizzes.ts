import { Question, QuizMeta, ExamProvider, ExamMeta } from '@/lib/types';

// Exam Providers (like CertyIQ)
export const examProviders: ExamProvider[] = [
  {
    id: 'microsoft',
    name: 'Microsoft',
    description: 'Azure, Microsoft 365, and other Microsoft certifications',
    examCount: 2,
    color: '#00A4EF',
  },
  {
    id: 'aws',
    name: 'Amazon Web Services',
    description: 'AWS Cloud certifications and specializations',
    examCount: 2,
    color: '#FF9900',
  },
  {
    id: 'google',
    name: 'Google Cloud',
    description: 'Google Cloud Platform certifications',
    examCount: 1,
    color: '#4285F4',
  },
  {
    id: 'comptia',
    name: 'CompTIA',
    description: 'Foundational IT certifications',
    examCount: 1,
    color: '#C8202F',
  },
  {
    id: 'general',
    name: 'General',
    description: 'General knowledge and practice exams',
    examCount: 3,
    color: '#6366F1',
  },
];

export const questions: Question[] = [
  // Mathematics - Algebra
  {
    id: 'math-1',
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'Easy',
    type: 'single',
    question: 'What is the value of x if 2x + 6 = 14?',
    options: [
      { id: 'a', text: '2' },
      { id: 'b', text: '4' },
      { id: 'c', text: '6' },
      { id: 'd', text: '8' },
    ],
    correctAnswers: ['b'],
    explanation:
      'To solve 2x + 6 = 14, subtract 6 from both sides to get 2x = 8, then divide by 2 to get x = 4.',
  },
  {
    id: 'math-2',
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'Medium',
    type: 'single',
    question: 'Simplify the expression: 3(x + 2) - 2(x - 1)',
    options: [
      { id: 'a', text: 'x + 4' },
      { id: 'b', text: 'x + 8' },
      { id: 'c', text: '5x + 4' },
      { id: 'd', text: 'x + 6' },
    ],
    correctAnswers: ['b'],
    explanation:
      '3(x + 2) - 2(x - 1) = 3x + 6 - 2x + 2 = x + 8. Distribute the coefficients first, then combine like terms.',
  },
  {
    id: 'math-3',
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'Hard',
    type: 'single',
    question: 'If f(x) = x² - 3x + 2, what are the roots of f(x)?',
    options: [
      { id: 'a', text: 'x = 1, x = 2' },
      { id: 'b', text: 'x = -1, x = -2' },
      { id: 'c', text: 'x = 0, x = 3' },
      { id: 'd', text: 'x = -1, x = 2' },
    ],
    correctAnswers: ['a'],
    explanation:
      'Factor x² - 3x + 2 = (x - 1)(x - 2) = 0. Setting each factor to zero gives x = 1 and x = 2.',
  },
  // Mathematics - Geometry
  {
    id: 'math-4',
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'Easy',
    type: 'single',
    question: 'What is the area of a rectangle with length 8 cm and width 5 cm?',
    options: [
      { id: 'a', text: '13 cm²' },
      { id: 'b', text: '26 cm²' },
      { id: 'c', text: '40 cm²' },
      { id: 'd', text: '45 cm²' },
    ],
    correctAnswers: ['c'],
    explanation: 'Area of a rectangle = length × width = 8 × 5 = 40 cm².',
  },
  {
    id: 'math-5',
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'Medium',
    type: 'single',
    question:
      'In a right triangle, if one leg is 3 and another leg is 4, what is the hypotenuse?',
    options: [
      { id: 'a', text: '5' },
      { id: 'b', text: '6' },
      { id: 'c', text: '7' },
      { id: 'd', text: '25' },
    ],
    correctAnswers: ['a'],
    explanation:
      'Using the Pythagorean theorem: c² = a² + b² = 3² + 4² = 9 + 16 = 25, so c = 5.',
  },
  {
    id: 'math-6',
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'Hard',
    type: 'multiple',
    question:
      'Which of the following are properties of a parallelogram? (Select all that apply)',
    options: [
      { id: 'a', text: 'Opposite sides are equal' },
      { id: 'b', text: 'All angles are 90°' },
      { id: 'c', text: 'Diagonals bisect each other' },
      { id: 'd', text: 'Opposite angles are equal' },
    ],
    correctAnswers: ['a', 'c', 'd'],
    explanation:
      'In a parallelogram: opposite sides are equal, diagonals bisect each other, and opposite angles are equal. Not all angles need to be 90° (that would be a rectangle).',
  },
  // Mathematics - Arithmetic
  {
    id: 'math-7',
    subject: 'Mathematics',
    topic: 'Arithmetic',
    difficulty: 'Easy',
    type: 'true-false',
    question: 'The product of two negative numbers is always negative.',
    options: [
      { id: 'true', text: 'True' },
      { id: 'false', text: 'False' },
    ],
    correctAnswers: ['false'],
    explanation:
      'The product of two negative numbers is always positive. For example, (-2) × (-3) = 6.',
  },
  {
    id: 'math-8',
    subject: 'Mathematics',
    topic: 'Arithmetic',
    difficulty: 'Medium',
    type: 'single',
    question: 'What is 15% of 80?',
    options: [
      { id: 'a', text: '8' },
      { id: 'b', text: '10' },
      { id: 'c', text: '12' },
      { id: 'd', text: '15' },
    ],
    correctAnswers: ['c'],
    explanation: '15% of 80 = 0.15 × 80 = 12. Alternatively, 10% of 80 is 8, and 5% is 4, so 15% is 12.',
  },
  // Computer Science - Programming
  {
    id: 'cs-1',
    subject: 'Computer Science',
    topic: 'Programming',
    difficulty: 'Easy',
    type: 'single',
    question: 'Which of the following is NOT a primitive data type in JavaScript?',
    options: [
      { id: 'a', text: 'string' },
      { id: 'b', text: 'number' },
      { id: 'c', text: 'array' },
      { id: 'd', text: 'boolean' },
    ],
    correctAnswers: ['c'],
    explanation:
      'In JavaScript, primitive types are: string, number, boolean, undefined, null, symbol, and bigint. Array is an object type, not a primitive.',
  },
  {
    id: 'cs-2',
    subject: 'Computer Science',
    topic: 'Programming',
    difficulty: 'Medium',
    type: 'single',
    question: 'What is the time complexity of binary search?',
    options: [
      { id: 'a', text: 'O(1)' },
      { id: 'b', text: 'O(n)' },
      { id: 'c', text: 'O(log n)' },
      { id: 'd', text: 'O(n²)' },
    ],
    correctAnswers: ['c'],
    explanation:
      'Binary search has O(log n) time complexity because it halves the search space with each comparison.',
  },
  {
    id: 'cs-3',
    subject: 'Computer Science',
    topic: 'Programming',
    difficulty: 'Hard',
    type: 'multiple',
    question:
      'Which of the following are valid ways to declare a variable in JavaScript? (Select all that apply)',
    options: [
      { id: 'a', text: 'var x = 5;' },
      { id: 'b', text: 'let x = 5;' },
      { id: 'c', text: 'const x = 5;' },
      { id: 'd', text: 'int x = 5;' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation:
      'JavaScript uses var, let, and const for variable declarations. "int" is not valid JavaScript syntax (it\'s used in languages like Java and C).',
  },
  // Computer Science - Data Structures
  {
    id: 'cs-4',
    subject: 'Computer Science',
    topic: 'Data Structures',
    difficulty: 'Easy',
    type: 'single',
    question: 'Which data structure follows the LIFO (Last In, First Out) principle?',
    options: [
      { id: 'a', text: 'Queue' },
      { id: 'b', text: 'Stack' },
      { id: 'c', text: 'Linked List' },
      { id: 'd', text: 'Tree' },
    ],
    correctAnswers: ['b'],
    explanation:
      'A Stack follows LIFO - the last element added is the first one removed. A Queue follows FIFO (First In, First Out).',
  },
  {
    id: 'cs-5',
    subject: 'Computer Science',
    topic: 'Data Structures',
    difficulty: 'Medium',
    type: 'true-false',
    question: 'A binary search tree must have at most two children for each node.',
    options: [
      { id: 'true', text: 'True' },
      { id: 'false', text: 'False' },
    ],
    correctAnswers: ['true'],
    explanation:
      'By definition, a binary tree (and thus a binary search tree) can have at most two children per node - a left child and a right child.',
  },
  {
    id: 'cs-6',
    subject: 'Computer Science',
    topic: 'Data Structures',
    difficulty: 'Hard',
    type: 'single',
    question: 'What is the worst-case time complexity of inserting into a hash table?',
    options: [
      { id: 'a', text: 'O(1)' },
      { id: 'b', text: 'O(log n)' },
      { id: 'c', text: 'O(n)' },
      { id: 'd', text: 'O(n²)' },
    ],
    correctAnswers: ['c'],
    explanation:
      'While average-case insertion is O(1), the worst case is O(n) when all keys hash to the same bucket, requiring traversal of all elements.',
  },
  // Computer Science - Algorithms
  {
    id: 'cs-7',
    subject: 'Computer Science',
    topic: 'Algorithms',
    difficulty: 'Easy',
    type: 'single',
    question:
      'Which sorting algorithm repeatedly swaps adjacent elements if they are in wrong order?',
    options: [
      { id: 'a', text: 'Merge Sort' },
      { id: 'b', text: 'Quick Sort' },
      { id: 'c', text: 'Bubble Sort' },
      { id: 'd', text: 'Heap Sort' },
    ],
    correctAnswers: ['c'],
    explanation:
      'Bubble Sort works by repeatedly stepping through the list and swapping adjacent elements if they are in the wrong order.',
  },
  {
    id: 'cs-8',
    subject: 'Computer Science',
    topic: 'Algorithms',
    difficulty: 'Medium',
    type: 'multiple',
    question:
      'Which of the following sorting algorithms have O(n log n) average time complexity? (Select all that apply)',
    options: [
      { id: 'a', text: 'Bubble Sort' },
      { id: 'b', text: 'Merge Sort' },
      { id: 'c', text: 'Quick Sort' },
      { id: 'd', text: 'Heap Sort' },
    ],
    correctAnswers: ['b', 'c', 'd'],
    explanation:
      'Merge Sort, Quick Sort (average case), and Heap Sort all have O(n log n) complexity. Bubble Sort has O(n²) complexity.',
  },
  // Additional Question
  {
    id: 'math-9',
    subject: 'Mathematics',
    topic: 'Statistics',
    difficulty: 'Medium',
    type: 'single',
    question: 'What is the median of the dataset: 3, 7, 9, 12, 15?',
    options: [
      { id: 'a', text: '7' },
      { id: 'b', text: '9' },
      { id: 'c', text: '9.2' },
      { id: 'd', text: '12' },
    ],
    correctAnswers: ['b'],
    explanation:
      'The median is the middle value when data is ordered. With 5 values, the median is the 3rd value, which is 9.',
  },
  {
    id: 'cs-9',
    subject: 'Computer Science',
    topic: 'Networking',
    difficulty: 'Easy',
    type: 'single',
    question: 'What does HTTP stand for?',
    options: [
      { id: 'a', text: 'Hyper Text Transfer Protocol' },
      { id: 'b', text: 'High Tech Transfer Protocol' },
      { id: 'c', text: 'Hyper Terminal Transfer Protocol' },
      { id: 'd', text: 'Home Tool Transfer Protocol' },
    ],
    correctAnswers: ['a'],
    explanation:
      'HTTP stands for Hyper Text Transfer Protocol, the foundation of data communication on the World Wide Web.',
  },
  // Azure Cloud Questions (Microsoft AZ-900 style)
  {
    id: 'azure-1',
    subject: 'Cloud Computing',
    topic: 'Azure Fundamentals',
    difficulty: 'Easy',
    type: 'single',
    question: 'Which Azure service provides serverless compute capabilities?',
    options: [
      { id: 'a', text: 'Azure Virtual Machines' },
      { id: 'b', text: 'Azure Functions' },
      { id: 'c', text: 'Azure Kubernetes Service' },
      { id: 'd', text: 'Azure Virtual Network' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Azure Functions is a serverless compute service that lets you run event-triggered code without managing infrastructure.',
  },
  {
    id: 'azure-2',
    subject: 'Cloud Computing',
    topic: 'Azure Fundamentals',
    difficulty: 'Easy',
    type: 'single',
    question: 'What are the three main cloud service models?',
    options: [
      { id: 'a', text: 'IaaS, PaaS, SaaS' },
      { id: 'b', text: 'Public, Private, Hybrid' },
      { id: 'c', text: 'Azure, AWS, GCP' },
      { id: 'd', text: 'Compute, Storage, Network' },
    ],
    correctAnswers: ['a'],
    explanation:
      'IaaS (Infrastructure as a Service), PaaS (Platform as a Service), and SaaS (Software as a Service) are the three main cloud service models.',
  },
  {
    id: 'azure-3',
    subject: 'Cloud Computing',
    topic: 'Azure Fundamentals',
    difficulty: 'Medium',
    type: 'multiple',
    question: 'Which of the following are benefits of cloud computing? (Select all that apply)',
    options: [
      { id: 'a', text: 'High availability' },
      { id: 'b', text: 'Scalability' },
      { id: 'c', text: 'No internet required' },
      { id: 'd', text: 'Pay-as-you-go pricing' },
    ],
    correctAnswers: ['a', 'b', 'd'],
    explanation:
      'Cloud computing provides high availability, scalability, and pay-as-you-go pricing. However, internet connectivity is generally required.',
  },
  {
    id: 'azure-4',
    subject: 'Cloud Computing',
    topic: 'Azure Services',
    difficulty: 'Medium',
    type: 'single',
    question: 'Which Azure service is used for storing unstructured data like images and documents?',
    options: [
      { id: 'a', text: 'Azure SQL Database' },
      { id: 'b', text: 'Azure Blob Storage' },
      { id: 'c', text: 'Azure Cosmos DB' },
      { id: 'd', text: 'Azure Table Storage' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Azure Blob Storage is optimized for storing massive amounts of unstructured data, such as images, documents, and media files.',
  },
  {
    id: 'azure-5',
    subject: 'Cloud Computing',
    topic: 'Azure Security',
    difficulty: 'Hard',
    type: 'single',
    question: 'What is the principle of least privilege in Azure security?',
    options: [
      { id: 'a', text: 'Give users maximum access to simplify management' },
      { id: 'b', text: 'Users should only have access to resources they need' },
      { id: 'c', text: 'Administrators should have no restrictions' },
      { id: 'd', text: 'All users share the same access level' },
    ],
    correctAnswers: ['b'],
    explanation:
      'The principle of least privilege states that users should only be granted the minimum permissions necessary to perform their job functions.',
  },
  // AWS Questions (AWS Cloud Practitioner style)
  {
    id: 'aws-1',
    subject: 'Cloud Computing',
    topic: 'AWS Fundamentals',
    difficulty: 'Easy',
    type: 'single',
    question: 'Which AWS service is used to deploy and manage containers?',
    options: [
      { id: 'a', text: 'Amazon EC2' },
      { id: 'b', text: 'Amazon ECS' },
      { id: 'c', text: 'Amazon S3' },
      { id: 'd', text: 'Amazon RDS' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Amazon Elastic Container Service (ECS) is a fully managed container orchestration service for deploying and managing Docker containers.',
  },
  {
    id: 'aws-2',
    subject: 'Cloud Computing',
    topic: 'AWS Fundamentals',
    difficulty: 'Easy',
    type: 'single',
    question: 'What is Amazon S3 primarily used for?',
    options: [
      { id: 'a', text: 'Running virtual machines' },
      { id: 'b', text: 'Object storage' },
      { id: 'c', text: 'Relational database' },
      { id: 'd', text: 'Content delivery' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Amazon Simple Storage Service (S3) is an object storage service offering industry-leading scalability, data availability, and security.',
  },
  {
    id: 'aws-3',
    subject: 'Cloud Computing',
    topic: 'AWS Services',
    difficulty: 'Medium',
    type: 'multiple',
    question: 'Which AWS services can be used for serverless computing? (Select all that apply)',
    options: [
      { id: 'a', text: 'AWS Lambda' },
      { id: 'b', text: 'Amazon EC2' },
      { id: 'c', text: 'AWS Fargate' },
      { id: 'd', text: 'Amazon API Gateway' },
    ],
    correctAnswers: ['a', 'c', 'd'],
    explanation:
      'Lambda, Fargate, and API Gateway are serverless services. EC2 requires you to manage virtual machine instances.',
  },
  {
    id: 'aws-4',
    subject: 'Cloud Computing',
    topic: 'AWS Security',
    difficulty: 'Medium',
    type: 'single',
    question: 'What is AWS IAM used for?',
    options: [
      { id: 'a', text: 'Monitoring application performance' },
      { id: 'b', text: 'Managing user access and permissions' },
      { id: 'c', text: 'Storing encrypted data' },
      { id: 'd', text: 'Load balancing traffic' },
    ],
    correctAnswers: ['b'],
    explanation:
      'AWS Identity and Access Management (IAM) enables you to manage access to AWS services and resources securely.',
  },
  {
    id: 'aws-5',
    subject: 'Cloud Computing',
    topic: 'AWS Architecture',
    difficulty: 'Hard',
    type: 'single',
    question: 'Which AWS service provides a global content delivery network?',
    options: [
      { id: 'a', text: 'Amazon Route 53' },
      { id: 'b', text: 'Amazon CloudFront' },
      { id: 'c', text: 'AWS Global Accelerator' },
      { id: 'd', text: 'Amazon VPC' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Amazon CloudFront is a fast content delivery network (CDN) service that securely delivers data, videos, and APIs to customers globally.',
  },
  // CompTIA Security+ style questions
  {
    id: 'security-1',
    subject: 'Security',
    topic: 'Network Security',
    difficulty: 'Easy',
    type: 'single',
    question: 'What type of attack involves sending fake ARP messages?',
    options: [
      { id: 'a', text: 'Phishing' },
      { id: 'b', text: 'ARP Spoofing' },
      { id: 'c', text: 'SQL Injection' },
      { id: 'd', text: 'Cross-site scripting' },
    ],
    correctAnswers: ['b'],
    explanation:
      'ARP Spoofing involves sending fake ARP (Address Resolution Protocol) messages to link the attacker\'s MAC address with a legitimate IP address.',
  },
  {
    id: 'security-2',
    subject: 'Security',
    topic: 'Cryptography',
    difficulty: 'Medium',
    type: 'single',
    question: 'What is the primary difference between symmetric and asymmetric encryption?',
    options: [
      { id: 'a', text: 'Speed of encryption' },
      { id: 'b', text: 'Number of keys used' },
      { id: 'c', text: 'Length of the encrypted output' },
      { id: 'd', text: 'Type of data that can be encrypted' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Symmetric encryption uses one key for both encryption and decryption, while asymmetric encryption uses a pair of keys (public and private).',
  },
  {
    id: 'security-3',
    subject: 'Security',
    topic: 'Risk Management',
    difficulty: 'Hard',
    type: 'multiple',
    question: 'Which of the following are components of the CIA triad? (Select all that apply)',
    options: [
      { id: 'a', text: 'Confidentiality' },
      { id: 'b', text: 'Integrity' },
      { id: 'c', text: 'Authentication' },
      { id: 'd', text: 'Availability' },
    ],
    correctAnswers: ['a', 'b', 'd'],
    explanation:
      'The CIA triad consists of Confidentiality, Integrity, and Availability. Authentication is a separate security concept.',
  },
  // Google Cloud questions
  {
    id: 'gcp-1',
    subject: 'Cloud Computing',
    topic: 'GCP Fundamentals',
    difficulty: 'Easy',
    type: 'single',
    question: 'What is Google Cloud\'s equivalent to AWS Lambda?',
    options: [
      { id: 'a', text: 'Cloud Run' },
      { id: 'b', text: 'Cloud Functions' },
      { id: 'c', text: 'Compute Engine' },
      { id: 'd', text: 'App Engine' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Cloud Functions is Google Cloud\'s serverless compute service, equivalent to AWS Lambda and Azure Functions.',
  },
  {
    id: 'gcp-2',
    subject: 'Cloud Computing',
    topic: 'GCP Services',
    difficulty: 'Medium',
    type: 'single',
    question: 'Which GCP service is a fully managed NoSQL database?',
    options: [
      { id: 'a', text: 'Cloud SQL' },
      { id: 'b', text: 'Cloud Firestore' },
      { id: 'c', text: 'BigQuery' },
      { id: 'd', text: 'Cloud Spanner' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Cloud Firestore is a flexible, scalable NoSQL cloud database for mobile, web, and server development.',
  },
];

// Quiz metadata with provider info
export const quizzes: QuizMeta[] = [
  {
    id: 'math-fundamentals',
    title: 'Mathematics Fundamentals',
    subject: 'Mathematics',
    description:
      'Test your knowledge of algebra, geometry, and arithmetic with this comprehensive mathematics quiz.',
    questions: questions.filter((q) => q.subject === 'Mathematics'),
    difficulty: 'Medium',
    duration: 20,
    tags: ['Algebra', 'Geometry', 'Arithmetic', 'Statistics'],
    questionCount: questions.filter((q) => q.subject === 'Mathematics').length,
  },
  {
    id: 'cs-essentials',
    title: 'Computer Science Essentials',
    subject: 'Computer Science',
    description:
      'Challenge yourself with programming concepts, data structures, and algorithms.',
    questions: questions.filter((q) => q.subject === 'Computer Science'),
    difficulty: 'Medium',
    duration: 25,
    tags: ['Programming', 'Data Structures', 'Algorithms', 'Networking'],
    questionCount: questions.filter((q) => q.subject === 'Computer Science').length,
  },
  {
    id: 'mixed-challenge',
    title: 'Mixed Challenge',
    subject: 'Mixed',
    description:
      'A comprehensive test covering both Mathematics and Computer Science topics.',
    questions: questions.filter((q) => q.subject === 'Mathematics' || q.subject === 'Computer Science'),
    difficulty: 'Hard',
    duration: 45,
    tags: ['Mathematics', 'Computer Science', 'Comprehensive'],
    questionCount: questions.filter((q) => q.subject === 'Mathematics' || q.subject === 'Computer Science').length,
  },
];

// Enhanced Exam Metadata (CertyIQ style)
export const exams: ExamMeta[] = [
  {
    id: 'az-900',
    title: 'Microsoft Azure Fundamentals',
    subject: 'Cloud Computing',
    description: 'Learn the fundamentals of cloud computing and Microsoft Azure services.',
    questions: questions.filter((q) => q.id.startsWith('azure-')),
    difficulty: 'Easy',
    duration: 60,
    tags: ['Azure', 'Cloud', 'Fundamentals', 'Microsoft'],
    questionCount: questions.filter((q) => q.id.startsWith('azure-')).length,
    provider: 'microsoft',
    examCode: 'AZ-900',
    lastUpdated: '2024-03-15',
    questionCountTotal: 5,
    passRate: 85,
    estimatedTime: 60,
    prerequisites: [],
    relatedExams: ['AZ-104', 'AZ-204'],
    popularity: 95,
  },
  {
    id: 'aws-clf-c02',
    title: 'AWS Cloud Practitioner',
    subject: 'Cloud Computing',
    description: 'Gain foundational understanding of AWS Cloud concepts, services, and terminology.',
    questions: questions.filter((q) => q.id.startsWith('aws-')),
    difficulty: 'Easy',
    duration: 90,
    tags: ['AWS', 'Cloud', 'Fundamentals', 'Amazon'],
    questionCount: questions.filter((q) => q.id.startsWith('aws-')).length,
    provider: 'aws',
    examCode: 'CLF-C02',
    lastUpdated: '2024-02-20',
    questionCountTotal: 5,
    passRate: 80,
    estimatedTime: 90,
    prerequisites: [],
    relatedExams: ['SAA-C03', 'DVA-C02'],
    popularity: 98,
  },
  {
    id: 'gcp-cloud-digital-leader',
    title: 'Google Cloud Digital Leader',
    subject: 'Cloud Computing',
    description: 'Understand core Google Cloud products and services.',
    questions: questions.filter((q) => q.id.startsWith('gcp-')),
    difficulty: 'Easy',
    duration: 90,
    tags: ['GCP', 'Cloud', 'Fundamentals', 'Google'],
    questionCount: questions.filter((q) => q.id.startsWith('gcp-')).length,
    provider: 'google',
    examCode: 'CDL',
    lastUpdated: '2024-01-10',
    questionCountTotal: 2,
    passRate: 82,
    estimatedTime: 90,
    prerequisites: [],
    relatedExams: ['ACE'],
    popularity: 75,
  },
  {
    id: 'security-plus',
    title: 'CompTIA Security+',
    subject: 'Security',
    description: 'Master cybersecurity fundamentals and best practices.',
    questions: questions.filter((q) => q.id.startsWith('security-')),
    difficulty: 'Medium',
    duration: 90,
    tags: ['Security', 'Cybersecurity', 'CompTIA', 'Networking'],
    questionCount: questions.filter((q) => q.id.startsWith('security-')).length,
    provider: 'comptia',
    examCode: 'SY0-701',
    lastUpdated: '2024-03-01',
    questionCountTotal: 3,
    passRate: 78,
    estimatedTime: 90,
    prerequisites: ['Network+'],
    relatedExams: ['CySA+', 'CASP+'],
    popularity: 88,
  },
  {
    id: 'all-cloud',
    title: 'Multi-Cloud Fundamentals',
    subject: 'Cloud Computing',
    description: 'Compare Azure, AWS, and GCP cloud services and concepts.',
    questions: questions.filter((q) => q.subject === 'Cloud Computing'),
    difficulty: 'Medium',
    duration: 60,
    tags: ['Azure', 'AWS', 'GCP', 'Multi-Cloud'],
    questionCount: questions.filter((q) => q.subject === 'Cloud Computing').length,
    provider: 'general',
    examCode: 'MC-100',
    lastUpdated: '2024-03-20',
    questionCountTotal: questions.filter((q) => q.subject === 'Cloud Computing').length,
    passRate: 72,
    estimatedTime: 60,
    prerequisites: [],
    relatedExams: [],
    popularity: 65,
  },
];

// Helper function to get quiz by ID
export function getQuizById(id: string): QuizMeta | undefined {
  return quizzes.find((quiz) => quiz.id === id);
}

// Helper function to get exam by ID
export function getExamById(id: string): ExamMeta | undefined {
  return exams.find((exam) => exam.id === id);
}

// Helper function to get any quiz or exam by ID
export function getAnyQuizById(id: string): QuizMeta | ExamMeta | undefined {
  return getQuizById(id) || getExamById(id);
}

// Helper function to get all unique subjects
export function getUniqueSubjects(): string[] {
  return [...new Set(questions.map((q) => q.subject))];
}

// Helper function to get all unique topics
export function getUniqueTopics(): string[] {
  return [...new Set(questions.map((q) => q.topic))];
}

// Helper function to get provider by ID
export function getProviderById(id: string): ExamProvider | undefined {
  return examProviders.find((p) => p.id === id);
}

// Helper function to get exams by provider
export function getExamsByProvider(providerId: string): ExamMeta[] {
  return exams.filter((e) => e.provider === providerId);
}

// Helper function to get all quizzes and exams combined
export function getAllQuizzes(): (QuizMeta | ExamMeta)[] {
  return [...quizzes, ...exams];
}

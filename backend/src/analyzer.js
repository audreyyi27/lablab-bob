// Repository Analysis Service
// Analyzes repository structure, content, and generates audience-specific documentation

import { githubFetch } from './github.js';
import { generateDocumentWithAI, isWatsonxConfigured } from './watsonx.js';

/**
 * Identify important files in the repository
 */
function identifyImportantFiles(tree) {
  const important = [];
  const patterns = {
    readme: /^readme\.(md|txt|rst)$/i,
    package: /^package\.json$/i,
    requirements: /^requirements\.txt$/i,
    gemfile: /^gemfile$/i,
    cargo: /^cargo\.toml$/i,
    gomod: /^go\.mod$/i,
    pom: /^pom\.xml$/i,
    build: /^build\.gradle$/i,
    dockerfile: /^dockerfile$/i,
    docker_compose: /^docker-compose\.ya?ml$/i,
    config: /\.(config|conf|cfg|ini|toml|yaml|yml)$/i,
    main: /^(main|index|app)\.(js|ts|py|go|java|rb|php|rs|cpp|c)$/i,
    license: /^license/i,
    contributing: /^contributing/i,
    changelog: /^changelog/i,
    makefile: /^makefile$/i,
    ci: /\.(github\/workflows|gitlab-ci|travis|circleci)/i,
  };

  for (const file of tree) {
    if (file.type !== 'blob') continue;
    
    const fileName = file.path.split('/').pop();
    const filePath = file.path.toLowerCase();
    
    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(fileName) || pattern.test(filePath)) {
        important.push({
          path: file.path,
          category,
          size: file.size || 0,
        });
        break;
      }
    }
  }

  return important.sort((a, b) => {
    const priority = ['readme', 'package', 'dockerfile', 'main', 'requirements'];
    const aIndex = priority.indexOf(a.category);
    const bIndex = priority.indexOf(b.category);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });
}

/**
 * Detect technologies and frameworks from file structure
 */
function detectTechnologies(tree, repoData) {
  const technologies = new Set();
  const frameworks = new Set();
  const tools = new Set();

  // Language from GitHub
  if (repoData.language) {
    technologies.add(repoData.language);
  }

  // Analyze file extensions and names
  for (const file of tree) {
    if (file.type !== 'blob') continue;
    
    const path = file.path.toLowerCase();
    const fileName = path.split('/').pop();

    // Frontend frameworks
    if (path.includes('package.json')) {
      frameworks.add('Node.js');
    }
    if (path.includes('angular.json')) frameworks.add('Angular');
    if (path.includes('vue.config.js') || path.includes('.vue')) frameworks.add('Vue.js');
    if (path.includes('svelte.config.js') || path.includes('.svelte')) frameworks.add('Svelte');
    if (path.includes('next.config.js')) frameworks.add('Next.js');
    if (path.includes('nuxt.config.js')) frameworks.add('Nuxt.js');
    if (path.includes('gatsby-config.js')) frameworks.add('Gatsby');
    
    // Backend frameworks
    if (path.includes('requirements.txt') || path.includes('setup.py')) {
      technologies.add('Python');
    }
    if (path.includes('django')) frameworks.add('Django');
    if (path.includes('flask')) frameworks.add('Flask');
    if (path.includes('fastapi')) frameworks.add('FastAPI');
    if (path.includes('gemfile')) {
      technologies.add('Ruby');
      frameworks.add('Ruby on Rails');
    }
    if (path.includes('cargo.toml')) technologies.add('Rust');
    if (path.includes('go.mod')) technologies.add('Go');
    if (path.includes('pom.xml') || path.includes('build.gradle')) {
      technologies.add('Java');
    }
    if (path.includes('spring')) frameworks.add('Spring Boot');
    
    // Databases
    if (path.includes('prisma')) tools.add('Prisma');
    if (path.includes('sequelize')) tools.add('Sequelize');
    if (path.includes('mongoose')) tools.add('MongoDB');
    if (path.includes('postgres') || path.includes('pg')) tools.add('PostgreSQL');
    if (path.includes('mysql')) tools.add('MySQL');
    if (path.includes('redis')) tools.add('Redis');
    
    // DevOps
    if (fileName === 'dockerfile' || path.includes('docker')) tools.add('Docker');
    if (path.includes('docker-compose')) tools.add('Docker Compose');
    if (path.includes('kubernetes') || path.includes('k8s')) tools.add('Kubernetes');
    if (path.includes('.github/workflows')) tools.add('GitHub Actions');
    if (path.includes('.gitlab-ci')) tools.add('GitLab CI');
    if (path.includes('terraform')) tools.add('Terraform');
    
    // Testing
    if (path.includes('jest') || path.includes('.test.') || path.includes('.spec.')) {
      tools.add('Jest');
    }
    if (path.includes('pytest')) tools.add('Pytest');
    if (path.includes('cypress')) tools.add('Cypress');
    
    // Build tools
    if (path.includes('webpack')) tools.add('Webpack');
    if (path.includes('vite')) tools.add('Vite');
    if (path.includes('rollup')) tools.add('Rollup');
    if (path.includes('tsconfig.json')) technologies.add('TypeScript');
  }

  return {
    technologies: Array.from(technologies),
    frameworks: Array.from(frameworks),
    tools: Array.from(tools),
  };
}

/**
 * Analyze repository architecture
 */
function analyzeArchitecture(tree) {
  const structure = {
    hasBackend: false,
    hasFrontend: false,
    hasDatabase: false,
    hasTests: false,
    hasCI: false,
    hasDocker: false,
    hasDocs: false,
    isMonorepo: false,
    folders: new Set(),
  };

  for (const file of tree) {
    const path = file.path.toLowerCase();
    const parts = path.split('/');
    
    if (parts.length > 1) {
      structure.folders.add(parts[0]);
    }

    // Architecture patterns
    if (path.includes('backend') || path.includes('server') || path.includes('api')) {
      structure.hasBackend = true;
    }
    if (path.includes('frontend') || path.includes('client') || path.includes('web')) {
      structure.hasFrontend = true;
    }
    if (path.includes('database') || path.includes('migrations') || path.includes('schema')) {
      structure.hasDatabase = true;
    }
    if (path.includes('test') || path.includes('spec') || path.includes('__tests__')) {
      structure.hasTests = true;
    }
    if (path.includes('.github/workflows') || path.includes('.gitlab-ci') || path.includes('.circleci')) {
      structure.hasCI = true;
    }
    if (path.includes('dockerfile') || path.includes('docker-compose')) {
      structure.hasDocker = true;
    }
    if (path.includes('docs') || path.includes('documentation')) {
      structure.hasDocs = true;
    }
  }

  // Check for monorepo
  const topLevelFolders = Array.from(structure.folders);
  if (topLevelFolders.includes('packages') || topLevelFolders.includes('apps')) {
    structure.isMonorepo = true;
  }

  structure.folders = topLevelFolders;
  return structure;
}

/**
 * Read file content from GitHub
 */
async function readFileContent(accessToken, owner, repo, path, ref) {
  try {
    const encodedPath = path.split('/').map(s => encodeURIComponent(s)).join('/');
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const data = await githubFetch(
      `/repos/${owner}/${repo}/contents/${encodedPath}${query}`,
      accessToken
    );

    if (data.content && data.encoding === 'base64') {
      const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
      return decoded;
    }
    return null;
  } catch (err) {
    console.warn(`Could not read ${path}:`, err.message);
    return null;
  }
}

/**
 * Extract key information from README
 */
function extractReadmeInfo(content) {
  if (!content) return null;

  const lines = content.split('\n');
  let title = '';
  let description = '';
  const features = [];
  
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i].trim();
    
    if (!title && line.startsWith('#')) {
      title = line.replace(/^#+\s*/, '').trim();
    } else if (!description && line && !line.startsWith('#') && !line.startsWith('!')) {
      description = line;
    }
    
    if (line.match(/^[-*]\s+/)) {
      features.push(line.replace(/^[-*]\s+/, '').trim());
    }
  }

  return {
    title: title || 'Untitled Project',
    description: description || 'No description available',
    features: features.slice(0, 5),
  };
}

/**
 * Generate audience-specific documentation
 */
function generateAudienceDocument(audience, analysisData) {
  const { repo, readme, tech, architecture } = analysisData;
  
  const templates = {
    ceo: generateCEODocument,
    product_manager: generatePMDocument,
    engineering_manager: generateEMDocument,
    software_engineer: generateEngineerDocument,
    designer: generateDesignerDocument,
    beginner: generateBeginnerDocument,
    investor: generateInvestorDocument,
  };

  const generator = templates[audience] || templates.beginner;
  return generator(repo, readme, tech, architecture);
}

function generateCEODocument(repo, readme, tech, architecture) {
  return {
    title: `Executive Summary: ${readme?.title || repo.name}`,
    sections: [
      {
        heading: '🎯 Business Overview',
        content: `${readme?.description || repo.description || 'A software project on GitHub'}\n\nThis ${repo.private ? 'private' : 'public'} repository has attracted ${repo.stargazers_count.toLocaleString()} stars and ${repo.forks_count.toLocaleString()} forks, indicating ${repo.stargazers_count > 1000 ? 'strong' : 'growing'} community interest.`,
      },
      {
        heading: '💼 Strategic Value',
        content: `**Technology Stack**: ${tech.technologies.join(', ') || 'Multiple technologies'}\n\n**Key Capabilities**:\n${readme?.features?.map(f => `• ${f}`).join('\n') || '• Modern software solution\n• Scalable architecture\n• Active development'}\n\n**Market Position**: ${repo.stargazers_count > 5000 ? 'Industry-leading open source project' : repo.stargazers_count > 1000 ? 'Established project with strong adoption' : 'Emerging solution with growth potential'}`,
      },
      {
        heading: '📊 Key Metrics',
        content: `• **Community Engagement**: ${repo.stargazers_count.toLocaleString()} stars, ${repo.watchers_count.toLocaleString()} watchers\n• **Collaboration**: ${repo.forks_count.toLocaleString()} forks\n• **Activity**: Last updated ${new Date(repo.updated_at).toLocaleDateString()}\n• **Maturity**: ${architecture.hasTests ? '✓ Tested' : '○ Testing needed'}, ${architecture.hasCI ? '✓ Automated CI/CD' : '○ Manual deployment'}, ${architecture.hasDocker ? '✓ Containerized' : '○ Traditional deployment'}`,
      },
      {
        heading: '🚀 Recommendations',
        content: architecture.hasTests && architecture.hasCI && architecture.hasDocker
          ? '• Project demonstrates production-ready practices\n• Consider for enterprise adoption\n• Strong foundation for scaling'
          : '• Evaluate testing and deployment practices\n• Assess technical debt and maintenance costs\n• Consider investment in DevOps infrastructure',
      },
    ],
  };
}

function generatePMDocument(repo, readme, tech, architecture) {
  return {
    title: `Product Analysis: ${readme?.title || repo.name}`,
    sections: [
      {
        heading: '📱 Product Overview',
        content: `${readme?.description || repo.description || 'A software product'}\n\n**Primary Language**: ${repo.language || 'Multiple'}\n**License**: ${repo.license?.name || 'Not specified'}`,
      },
      {
        heading: '✨ Key Features',
        content: readme?.features?.length
          ? readme.features.map(f => `• ${f}`).join('\n')
          : '• Feature documentation in progress\n• Check README for latest capabilities\n• Active development ongoing',
      },
      {
        heading: '🏗️ Architecture & Capabilities',
        content: `**System Design**:\n${architecture.hasFrontend ? '• Frontend application' : ''}\n${architecture.hasBackend ? '• Backend/API services' : ''}\n${architecture.hasDatabase ? '• Database layer' : ''}\n${architecture.isMonorepo ? '• Monorepo structure (multiple packages)' : ''}\n\n**Technology Stack**:\n• ${tech.technologies.join(', ') || 'Modern tech stack'}\n${tech.frameworks.length ? `• Frameworks: ${tech.frameworks.join(', ')}` : ''}\n${tech.tools.length ? `• Tools: ${tech.tools.join(', ')}` : ''}`,
      },
      {
        heading: '📈 Market Traction',
        content: `• **Stars**: ${repo.stargazers_count.toLocaleString()} (community interest indicator)\n• **Forks**: ${repo.forks_count.toLocaleString()} (adoption & contribution)\n• **Activity**: ${repo.open_issues_count || 0} open issues\n• **Last Update**: ${new Date(repo.updated_at).toLocaleDateString()}\n\n${repo.stargazers_count > 1000 ? '**Strong market validation** with significant community adoption.' : '**Growing project** with potential for expansion.'}`,
      },
      {
        heading: '🎯 Product Roadmap Insights',
        content: `Based on the repository structure:\n\n${architecture.hasTests ? '✓ Quality assurance in place' : '○ Testing infrastructure needed'}\n${architecture.hasCI ? '✓ Automated deployment pipeline' : '○ CI/CD setup recommended'}\n${architecture.hasDocs ? '✓ Documentation available' : '○ Documentation needs improvement'}\n${architecture.hasDocker ? '✓ Containerized for easy deployment' : '○ Containerization would improve deployment'}\n\n**Recommendation**: ${architecture.hasTests && architecture.hasCI ? 'Production-ready for scaling' : 'Invest in infrastructure before major launch'}`,
      },
    ],
  };
}

function generateEMDocument(repo, readme, tech, architecture) {
  return {
    title: `Engineering Analysis: ${readme?.title || repo.name}`,
    sections: [
      {
        heading: '🔧 Technical Stack',
        content: `**Primary Language**: ${repo.language || 'Multiple'}\n\n**Technologies**:\n${tech.technologies.map(t => `• ${t}`).join('\n') || '• Modern stack'}\n\n**Frameworks**:\n${tech.frameworks.map(f => `• ${f}`).join('\n') || '• Standard frameworks'}\n\n**Tools & Infrastructure**:\n${tech.tools.map(t => `• ${t}`).join('\n') || '• Essential tooling'}`,
      },
      {
        heading: '🏗️ Architecture Assessment',
        content: `**Project Structure**:\n${architecture.isMonorepo ? '• Monorepo architecture' : '• Standard repository'}\n${architecture.hasFrontend ? '• Frontend layer present' : ''}\n${architecture.hasBackend ? '• Backend/API layer present' : ''}\n${architecture.hasDatabase ? '• Database integration' : ''}\n\n**Top-level directories**: ${architecture.folders.join(', ') || 'Standard structure'}`,
      },
      {
        heading: '✅ Engineering Practices',
        content: `**Quality Assurance**:\n${architecture.hasTests ? '✓ Test suite implemented' : '⚠️ No test directory found'}\n\n**CI/CD**:\n${architecture.hasCI ? '✓ Continuous integration configured' : '⚠️ No CI/CD pipeline detected'}\n\n**Containerization**:\n${architecture.hasDocker ? '✓ Docker support available' : '○ No Docker configuration'}\n\n**Documentation**:\n${architecture.hasDocs ? '✓ Documentation directory present' : '○ Limited documentation structure'}\n\n**Overall Maturity**: ${(architecture.hasTests && architecture.hasCI && architecture.hasDocker) ? 'Production-ready' : (architecture.hasTests || architecture.hasCI) ? 'Development stage' : 'Early stage'}`,
      },
      {
        heading: '👥 Team & Collaboration',
        content: `• **Activity Level**: Last updated ${new Date(repo.updated_at).toLocaleDateString()}\n• **Community Size**: ${repo.stargazers_count.toLocaleString()} stars, ${repo.forks_count.toLocaleString()} forks\n• **Open Issues**: ${repo.open_issues_count || 0}\n• **Collaboration**: ${repo.forks_count > 50 ? 'High contributor activity' : repo.forks_count > 10 ? 'Moderate contributor activity' : 'Limited external contributions'}`,
      },
      {
        heading: '📋 Engineering Recommendations',
        content: `**Immediate Actions**:\n${!architecture.hasTests ? '• Implement comprehensive test coverage' : ''}\n${!architecture.hasCI ? '• Set up CI/CD pipeline' : ''}\n${!architecture.hasDocker ? '• Add Docker support for consistent environments' : ''}\n${!architecture.hasDocs ? '• Improve technical documentation' : ''}\n\n**Long-term Strategy**:\n• ${architecture.hasTests && architecture.hasCI ? 'Focus on scaling and performance optimization' : 'Establish engineering best practices foundation'}\n• Monitor and reduce technical debt\n• Enhance developer experience and onboarding`,
      },
    ],
  };
}

function generateEngineerDocument(repo, readme, tech, architecture) {
  return {
    title: `Technical Deep Dive: ${readme?.title || repo.name}`,
    sections: [
      {
        heading: '💻 Tech Stack',
        content: `\`\`\`\nLanguage: ${repo.language || 'Multiple'}\nFrameworks: ${tech.frameworks.join(', ') || 'N/A'}\nTools: ${tech.tools.join(', ') || 'Standard tooling'}\n\`\`\`\n\n**All Technologies**: ${[...tech.technologies, ...tech.frameworks, ...tech.tools].join(', ')}`,
      },
      {
        heading: '📁 Project Structure',
        content: `**Architecture Type**: ${architecture.isMonorepo ? 'Monorepo' : 'Standard repository'}\n\n**Main Directories**:\n${architecture.folders.map(f => `• \`${f}/\``).join('\n') || '• Standard structure'}\n\n**Components**:\n${architecture.hasFrontend ? '• Frontend application' : ''}\n${architecture.hasBackend ? '• Backend/API services' : ''}\n${architecture.hasDatabase ? '• Database layer' : ''}\n${architecture.hasTests ? '• Test suite' : ''}\n${architecture.hasDocs ? '• Documentation' : ''}`,
      },
      {
        heading: '🔨 Development Setup',
        content: `**Prerequisites**:\n• ${repo.language || 'Check README for language requirements'}\n${tech.frameworks.length ? `• ${tech.frameworks[0]} (and dependencies)` : ''}\n${architecture.hasDocker ? '• Docker (optional but recommended)' : ''}\n\n**Getting Started**:\n1. Clone the repository\n2. ${architecture.hasDocker ? 'Run \`docker-compose up\` OR install dependencies' : 'Install dependencies'}\n3. ${architecture.hasTests ? 'Run tests to verify setup' : 'Check README for setup instructions'}\n4. Start development server\n\n**Testing**:\n${architecture.hasTests ? '✓ Test suite available - run before committing' : '⚠️ No test directory found - consider adding tests'}`,
      },
      {
        heading: '🚀 Deployment',
        content: `**CI/CD**: ${architecture.hasCI ? '✓ Automated pipeline configured' : '⚠️ Manual deployment process'}\n\n**Containerization**: ${architecture.hasDocker ? '✓ Docker support available' : '○ No Docker configuration found'}\n\n**Infrastructure**: ${tech.tools.includes('Kubernetes') ? 'Kubernetes-ready' : tech.tools.includes('Docker') ? 'Docker-based deployment' : 'Traditional deployment'}`,
      },
      {
        heading: '📚 Resources',
        content: `• **Repository**: ${repo.html_url}\n• **Stars**: ${repo.stargazers_count.toLocaleString()}\n• **Forks**: ${repo.forks_count.toLocaleString()}\n• **License**: ${repo.license?.name || 'Not specified'}\n• **Last Updated**: ${new Date(repo.updated_at).toLocaleDateString()}\n\n${architecture.hasDocs ? '**Documentation**: Check the \`docs/\` directory for detailed guides' : '**Documentation**: Refer to README.md for project information'}`,
      },
    ],
  };
}

function generateDesignerDocument(repo, readme, tech, architecture) {
  return {
    title: `Design Overview: ${readme?.title || repo.name}`,
    sections: [
      {
        heading: '🎨 Project Overview',
        content: `${readme?.description || repo.description || 'A software project'}\n\n**Type**: ${architecture.hasFrontend ? 'Frontend application with UI components' : 'Backend/API project (limited UI)'}\n**Primary Language**: ${repo.language || 'Multiple'}`,
      },
      {
        heading: '🖼️ UI/UX Components',
        content: architecture.hasFrontend
          ? `This project includes a frontend application.\n\n**Frontend Technologies**:\n${tech.frameworks.filter(f => ['React', 'Vue.js', 'Angular', 'Svelte', 'Next.js'].some(fe => f.includes(fe))).map(f => `• ${f}`).join('\n') || '• Modern frontend framework'}\n\n**Styling Approach**:\n${tech.tools.includes('Tailwind') ? '• Tailwind CSS (utility-first)' : ''}\n${tech.technologies.includes('CSS') || tech.technologies.includes('SCSS') ? '• Custom CSS/SCSS' : ''}\n\n**Design System**: ${architecture.folders.includes('components') ? 'Component-based architecture detected' : 'Check codebase for component structure'}`
          : `This appears to be a backend/API project with limited UI components.\n\n**Design Considerations**:\n• Focus on API design and data structures\n• Documentation and developer experience\n• Error messages and response formats`,
      },
      {
        heading: '🎯 User Experience',
        content: `**Target Users**: ${readme?.description || 'Developers and technical users'}\n\n**Key Features**:\n${readme?.features?.map(f => `• ${f}`).join('\n') || '• Check README for feature list'}\n\n**Accessibility**: ${architecture.hasTests ? 'Testing infrastructure in place (may include accessibility tests)' : 'No automated testing detected'}`,
      },
      {
        heading: '📱 Design Assets',
        content: `**Asset Locations**:\n${architecture.folders.includes('assets') ? '• \`assets/\` directory' : ''}\n${architecture.folders.includes('public') ? '• \`public/\` directory' : ''}\n${architecture.folders.includes('static') ? '• \`static/\` directory' : ''}\n${!architecture.folders.includes('assets') && !architecture.folders.includes('public') && !architecture.folders.includes('static') ? '• Check repository for image and asset files' : ''}\n\n**Design Documentation**: ${architecture.hasDocs ? 'Available in \`docs/\` directory' : 'Refer to README.md'}`,
      },
      {
        heading: '🔧 Design Tools & Workflow',
        content: `**Collaboration**:\n• Repository: ${repo.html_url}\n• ${repo.stargazers_count.toLocaleString()} stars (community interest)\n• ${repo.forks_count.toLocaleString()} forks (active contributions)\n\n**Design Handoff**:\n${architecture.hasFrontend ? '• Frontend codebase available for inspection\n• Component structure can guide design system' : '• Focus on API documentation and data visualization\n• Consider creating admin/dashboard interfaces'}\n\n**Recommended Next Steps**:\n• Review existing UI components\n• Document design patterns and guidelines\n• Create or update design system documentation`,
      },
    ],
  };
}

function generateBeginnerDocument(repo, readme, tech, architecture) {
  return {
    title: `Beginner's Guide: ${readme?.title || repo.name}`,
    sections: [
      {
        heading: '👋 Welcome!',
        content: `This is **${readme?.title || repo.name}**, a software project hosted on GitHub.\n\n**What it does**: ${readme?.description || repo.description || 'This project helps developers build software applications.'}\n\n**Why it matters**: With ${repo.stargazers_count.toLocaleString()} stars on GitHub, this project has caught the attention of the developer community!`,
      },
      {
        heading: '🎓 What You Will Learn',
        content: `By exploring this project, you will learn about:\n\n**Programming Language**: ${repo.language || 'Multiple programming languages'}\n${repo.language === 'JavaScript' ? '• JavaScript is used to make websites interactive' : ''}\n${repo.language === 'Python' ? '• Python is great for beginners and used in AI, web apps, and more' : ''}\n${repo.language === 'TypeScript' ? '• TypeScript adds type safety to JavaScript' : ''}\n${repo.language === 'Java' ? '• Java is used for Android apps and enterprise software' : ''}\n\n**Technologies**:\n${tech.technologies.slice(0, 3).map(t => `• ${t}`).join('\n') || '• Modern software development tools'}`,
      },
      {
        heading: '📚 Project Structure (Simplified)',
        content: `Think of this project like a house with different rooms:\n\n${architecture.hasFrontend ? '🏠 **Frontend** - The "face" of the application (what users see and click)' : ''}\n${architecture.hasBackend ? '⚙️ **Backend** - The "brain" that processes data and handles logic' : ''}\n${architecture.hasDatabase ? '💾 **Database** - The "memory" where information is stored' : ''}\n${architecture.hasTests ? '✅ **Tests** - Quality checks to make sure everything works' : ''}\n\n**Main folders**: ${architecture.folders.slice(0, 5).join(', ')}`,
      },
      {
        heading: '🚀 How to Get Started',
        content: `**Step 1**: Visit the repository\n• Go to: ${repo.html_url}\n• Click the green "Code" button to download\n\n**Step 2**: Read the README\n• The README file explains how to set up the project\n• It is like an instruction manual\n\n**Step 3**: Install requirements\n${repo.language === 'JavaScript' || repo.language === 'TypeScript' ? '• You will need Node.js installed on your computer' : ''}\n${repo.language === 'Python' ? '• You will need Python installed on your computer' : ''}\n${architecture.hasDocker ? '• Or use Docker (a tool that packages everything you need)' : ''}\n\n**Step 4**: Explore the code\n• Start with simple files and work your way up\n• Do not worry if you do not understand everything at first!`,
      },
      {
        heading: '💡 Learning Resources',
        content: `**Understanding this project**:\n• **Stars** (${repo.stargazers_count.toLocaleString()}): Like "likes" - shows how many people find it useful\n• **Forks** (${repo.forks_count.toLocaleString()}): Copies people made to experiment or contribute\n• **License** (${repo.license?.name || 'Check repository'}): Rules for how you can use the code\n\n**Next steps for learning**:\n1. Read the README file carefully\n2. Look at the code structure\n3. Try running the project locally\n4. Make small changes and see what happens\n5. Join the community and ask questions!\n\n**Remember**: Every expert was once a beginner. Take your time and enjoy learning! 🌟`,
      },
    ],
  };
}

function generateInvestorDocument(repo, readme, tech, architecture) {
  return {
    title: `Investment Analysis: ${readme?.title || repo.name}`,
    sections: [
      {
        heading: '💼 Executive Summary',
        content: `**Project**: ${readme?.title || repo.name}\n**Description**: ${readme?.description || repo.description || 'Software technology project'}\n**Visibility**: ${repo.private ? 'Private repository' : 'Public open-source project'}\n**License**: ${repo.license?.name || 'Proprietary/Not specified'}`,
      },
      {
        heading: '📊 Market Validation',
        content: `**Community Metrics**:\n• **GitHub Stars**: ${repo.stargazers_count.toLocaleString()} ${repo.stargazers_count > 10000 ? '(Exceptional - Top tier project)' : repo.stargazers_count > 1000 ? '(Strong - Proven market interest)' : repo.stargazers_count > 100 ? '(Growing - Early traction)' : '(Emerging - Early stage)'}\n• **Forks**: ${repo.forks_count.toLocaleString()} (developer adoption indicator)\n• **Watchers**: ${repo.watchers_count.toLocaleString()} (active follower base)\n• **Open Issues**: ${repo.open_issues_count || 0} (community engagement)\n\n**Market Position**: ${repo.stargazers_count > 5000 ? 'Market leader in its category with strong network effects' : repo.stargazers_count > 1000 ? 'Established player with proven product-market fit' : 'Early-stage with growth potential'}`,
      },
      {
        heading: '🔧 Technology Assessment',
        content: `**Tech Stack Maturity**:\n• **Primary**: ${tech.technologies.join(', ') || 'Modern stack'}\n• **Frameworks**: ${tech.frameworks.join(', ') || 'Industry-standard'}\n• **Infrastructure**: ${tech.tools.join(', ') || 'Essential tooling'}\n\n**Technical Risk Assessment**:\n${architecture.hasTests ? '✓ Low risk - Automated testing in place' : '⚠️ Medium risk - Limited test coverage'}\n${architecture.hasCI ? '✓ Low risk - Automated deployment pipeline' : '⚠️ Medium risk - Manual deployment process'}\n${architecture.hasDocker ? '✓ Low risk - Containerized and portable' : '○ Consider - Traditional deployment'}\n\n**Scalability**: ${(architecture.hasBackend && architecture.hasDatabase && architecture.hasDocker) ? 'High - Modern, scalable architecture' : 'Moderate - May require infrastructure investment'}`,
      },
      {
        heading: '💰 Business Model Potential',
        content: `**Monetization Opportunities**:\n${repo.license?.name?.includes('MIT') || repo.license?.name?.includes('Apache') ? '• Open-source with commercial licensing potential\n• SaaS offering opportunities\n• Enterprise support and consulting' : repo.license?.name ? '• License allows commercial use\n• Multiple revenue stream options' : '• Proprietary - full control over commercialization'}\n\n**Market Size Indicators**:\n• ${repo.stargazers_count > 1000 ? 'Large addressable market (1000+ interested developers)' : 'Niche market or early stage'}\n• ${repo.forks_count > 100 ? 'High developer engagement (100+ forks)' : 'Growing developer interest'}\n• Technology stack aligns with ${tech.technologies.includes('JavaScript') || tech.technologies.includes('TypeScript') ? 'web/mobile development (massive market)' : tech.technologies.includes('Python') ? 'AI/ML and data science (high-growth sector)' : 'enterprise software needs'}`,
      },
      {
        heading: '⚖️ Risk Analysis',
        content: `**Technical Risks**:\n• Code quality: ${architecture.hasTests ? 'Mitigated (tests present)' : 'Moderate (no test suite)'}\n• Deployment complexity: ${architecture.hasDocker && architecture.hasCI ? 'Low (automated)' : 'Medium (manual processes)'}\n• Scalability: ${architecture.hasBackend && architecture.hasDatabase ? 'Prepared for growth' : 'May need architecture updates'}\n\n**Market Risks**:\n• Competition: ${repo.stargazers_count > 5000 ? 'Market leader position' : repo.stargazers_count > 1000 ? 'Competitive but differentiated' : 'Emerging market space'}\n• Adoption: ${repo.forks_count > 50 ? 'Strong developer adoption' : 'Building momentum'}\n• Community: ${repo.stargazers_count > 1000 ? 'Active and engaged' : 'Growing community'}\n\n**Overall Risk Level**: ${(architecture.hasTests && architecture.hasCI && repo.stargazers_count > 1000) ? 'LOW - Mature project with proven traction' : (architecture.hasTests || architecture.hasCI || repo.stargazers_count > 100) ? 'MEDIUM - Solid foundation, needs scaling' : 'MEDIUM-HIGH - Early stage, requires investment'}`,
      },
      {
        heading: '🎯 Investment Recommendation',
        content: `**Strengths**:\n• ${repo.stargazers_count > 1000 ? 'Proven market demand' : 'Early mover advantage'}\n• ${tech.technologies.length > 0 ? `Modern tech stack (${tech.technologies.join(', ')})` : 'Flexible technology approach'}\n• ${architecture.hasTests && architecture.hasCI ? 'Production-ready infrastructure' : 'Room for operational improvements'}\n• ${repo.forks_count > 50 ? 'Strong developer community' : 'Growing contributor base'}\n\n**Investment Thesis**:\n${repo.stargazers_count > 5000 ? '**STRONG BUY** - Market-leading position with proven traction. Consider for immediate investment or acquisition.' : repo.stargazers_count > 1000 ? '**BUY** - Solid product-market fit with growth potential. Good investment opportunity with manageable risk.' : repo.stargazers_count > 100 ? '**HOLD/BUY** - Early traction visible. Suitable for early-stage investors comfortable with higher risk.' : '**WATCH** - Very early stage. Monitor for growth signals before committing capital.'}\n\n**Recommended Action**:\n• ${repo.stargazers_count > 1000 ? 'Conduct due diligence and prepare term sheet' : 'Continue monitoring metrics and community growth'}\n• ${!architecture.hasTests || !architecture.hasCI ? 'Budget for infrastructure improvements' : 'Invest in scaling and market expansion'}\n• Estimated runway to profitability: ${(architecture.hasTests && architecture.hasCI && repo.stargazers_count > 1000) ? '12-18 months' : '18-36 months'}`,
      },
    ],
  };
}

/**
 * Main analysis function
 */
export async function analyzeRepository(accessToken, owner, repo, repoData, treeData, branch) {
  try {
    // Identify important files
    const importantFiles = identifyImportantFiles(treeData.tree);
    
    // Detect technologies
    const tech = detectTechnologies(treeData.tree, repoData);
    
    // Analyze architecture
    const architecture = analyzeArchitecture(treeData.tree);
    
    // Read README if available
    let readmeContent = null;
    const readmeFile = importantFiles.find(f => f.category === 'readme');
    if (readmeFile) {
      readmeContent = await readFileContent(accessToken, owner, repo, readmeFile.path, branch);
    }
    
    const readme = extractReadmeInfo(readmeContent);
    
    // Prepare analysis data
    const analysisData = {
      repo: repoData,
      readme,
      tech,
      architecture,
      importantFiles: importantFiles.slice(0, 10),
    };
    
    return analysisData;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}

/**
 * Generate document for specific audience
 * Uses watsonx.ai if configured, otherwise falls back to template-based generation
 */
export async function generateDocument(audience, analysisData, useAI = true) {
  // Try watsonx.ai first if configured and requested
  if (useAI && isWatsonxConfigured()) {
    try {
      console.log(`Generating document with watsonx.ai for audience: ${audience}`);
      const aiDocument = await generateDocumentWithAI(audience, analysisData);
      return {
        ...aiDocument,
        generatedBy: 'watsonx.ai',
        model: 'IBM watsonx.ai Runtime / WML'
      };
    } catch (error) {
      console.warn('watsonx.ai generation failed, falling back to templates:', error.message);
      // Fall through to template-based generation
    }
  }

  // Fallback to template-based generation
  console.log(`Generating document with templates for audience: ${audience}`);
  const templateDocument = generateAudienceDocument(audience, analysisData);
  return {
    ...templateDocument,
    generatedBy: 'template',
    model: 'Built-in templates'
  };
}

// Made with Bob

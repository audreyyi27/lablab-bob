// Repository Analysis Service
// Analyzes repository structure, content, and generates audience-specific documentation

import { githubFetch } from './github.js';
import {
  generateDocumentWithAI,
  generateDocumentFromTemplate,
  isWatsonxConfigured,
} from './watsonx.js';

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
 * Generate audience-specific documentation.
 * Uses watsonx.ai when WATSONX_API_KEY + WATSONX_PROJECT_ID are set;
 * otherwise falls back to template mode (hackathon-friendly, no ML project needed).
 */
export async function generateDocument(audience, analysisData) {
  if (isWatsonxConfigured()) {
    try {
      return await generateDocumentWithAI(audience, analysisData);
    } catch (error) {
      console.warn(
        `[analyze] watsonx.ai failed (${error.message}), using template fallback`
      );
    }
  } else {
    console.log(
      `[analyze] watsonx.ai not fully configured — generating document from templates for audience: ${audience}`
    );
  }

  return generateDocumentFromTemplate(audience, analysisData);
}

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/** Runtime edges only: type imports do not create a browser dependency or a cycle. */
function runtimeDeclaration(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    const named = clause?.namedBindings;
    if (clause?.isTypeOnly) return null;
    if (!clause?.name && named && ts.isNamedImports(named) && named.elements.length > 0
      && named.elements.every(item => item.isTypeOnly)) return null;
    return node.moduleSpecifier.text;
  }
  if (!ts.isExportDeclaration(node) || !node.moduleSpecifier || node.isTypeOnly) return null;
  if (node.exportClause && ts.isNamedExports(node.exportClause)
    && node.exportClause.elements.length > 0 && node.exportClause.elements.every(item => item.isTypeOnly)) return null;
  return node.moduleSpecifier.text;
}

function runtimeSpecifiers(contents, file = 'module.ts') {
  const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true);
  const imports = new Set(source.statements.map(runtimeDeclaration).filter(value => value !== null));
  function dynamicImports(node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) imports.add(node.arguments[0].text);
    ts.forEachChild(node, dynamicImports);
  }
  dynamicImports(source);
  return [...imports];
}

function runtimeImports(file) {
  return runtimeSpecifiers(fs.readFileSync(file, 'utf8'), file);
}

function resolveLocal(file, imported) {
  const target = path.resolve(path.dirname(file), imported);
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => target + suffix)
    .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.tsx?$/.test(file) ? [file] : [];
  }).sort();
}

function sourceGraph(directory) {
  return new Map(sourceFiles(directory).map(file => [file, runtimeImports(file)
    .filter(imported => imported.startsWith('.')).map(imported => {
      const resolved = resolveLocal(file, imported);
      if (!resolved) throw new Error(`${file}: unresolved dependency ${imported}`);
      return resolved;
    }).filter(resolved => /\.tsx?$/.test(resolved))]));
}

function findCycles(graph) {
  const visited = new Set(), active = new Set(), stack = [], cycles = [];
  function visit(file) {
    if (active.has(file)) { cycles.push([...stack.slice(stack.indexOf(file)), file]); return; }
    if (visited.has(file)) return;
    visited.add(file); active.add(file); stack.push(file);
    for (const dependency of graph.get(file) ?? []) visit(dependency);
    stack.pop(); active.delete(file);
  }
  for (const file of graph.keys()) visit(file);
  return cycles;
}

module.exports = { runtimeSpecifiers, runtimeImports, resolveLocal, sourceGraph, findCycles };

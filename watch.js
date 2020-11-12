const esbuild = require('esbuild');

const BUILD_DIR = './build';

const WATCH = "./**/*.[jt]s?";

const ENVIRONMENT = 'development'; //process.env.NODE_ENV;

const config = {
    entryPoints: ['./src/.tsx'],
    outfile: `${BUILD_DIR}/app${!('development' === ENVIRONMENT) ? '.min' : ''}.js`,
    target: 'esnext',
    minify: !('development' === ENVIRONMENT),
    bundle: true,
    sourcemap: 'development' === ENVIRONMENT,
    define: {
        'process.env.NODE_ENV': '"development"',
    },
    external: ['require', 'fs', 'path']
};

console.log("Building...");
// build initial
esbuild.build(config).then(r => {
    console.log("Built...");

    console.log("Watching...")
    bs.watch(WATCH, function (event, file) {
        require('esbuild').build(config)
        .then(() => bs.reload())
        .catch(() => process.exit(1))
    });

});


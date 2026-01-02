import gulp from "gulp";
import { deleteAsync as del } from "del";
import { readFileSync, writeFileSync, createWriteStream, copyFileSync, existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import babel from "gulp-babel";
import archiver from "archiver";
import path from "path";

const execAsync = promisify(exec);

console.info("Building Moonfin Tizen app");

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
const version = pkg.version;

function clean() {
   return del(["build/**", "!build"]);
}

function updateVersion(cb) {
   const versionContent = `var APP_VERSION = '${version}';\n`;
   writeFileSync("./js/app-version.js", versionContent);
   console.info(`Updated app-version.js to version ${version}`);
   
   // Update config.xml version
   try {
      const configPath = "./config.xml";
      let configXml = readFileSync(configPath, "utf8");
      configXml = configXml.replace(
         /(<widget[^>]+version=\")[^\"]+(\")/, 
         `$1${version}$2`
      );
      writeFileSync(configPath, configXml);
      console.info(`Updated config.xml to version ${version}`);
   } catch (e) {
      console.warn("Warning: Failed to update config.xml:", e.message);
   }
   
   cb();
}

function copyFiles() {
   return gulp
      .src(
         [
            "*.html",
            "*.xml",
            "shaka-player.js",
            "hls.js",
            "css/**/*",
            "js/**/*",
            "assets/**/*",
            "components/**/*",
         ],
         { base: ".", encoding: false }
      )
      .pipe(gulp.dest("build/"));
}

// Copy files and transpile JS to ES5 for Tizen 2.4 compatibility
function copyFilesES5() {
   gulp
      .src(
         [
            "*.html",
            "*.xml",
            "shaka-player.js",
            "hls.js",
            "css/**/*",
            "assets/**/*",
            "components/**/*",
         ],
         { base: ".", encoding: false }
      )
      .pipe(gulp.dest("build/"));

   return gulp
      .src("js/**/*.js", { base: "." })
      .pipe(babel())
      .pipe(gulp.dest("build/"));
}

async function packageWgt() {
   const versionedWgtName = `Moonfin-Tizen-${version}.wgt`;
   const wgtName = "Moonfin.wgt";
   await del([versionedWgtName, wgtName]);

   try {
      const signatureFiles = [
         { src: ".sign/author-signature.xml", dest: "build/author-signature.xml" },
         { src: ".sign/signature1.xml", dest: "build/signature1.xml" }
      ];
      
      let copied = false;
      for (const file of signatureFiles) {
         if (existsSync(file.src)) {
            copyFileSync(file.src, file.dest);
            copied = true;
         }
      }
      
      if (copied) {
         console.info("Added signature files to build directory");
      } else {
         console.warn("Warning: No signature files found - package may not install on device");
      }
   } catch (e) {
      console.warn("Warning: Failed to copy signature files:", e.message);
   }

   async function createZip(outputPath) {
      return new Promise((resolve, reject) => {
         const output = createWriteStream(outputPath);
         const archive = archiver("zip", { zlib: { level: 9 } });

         output.on("close", () => {
            console.info(`Package created: ${path.basename(outputPath)} (${archive.pointer()} bytes)`);
            resolve();
         });

         archive.on("error", (err) => reject(err));

         archive.pipe(output);
         archive.directory("build/", false);
         archive.finalize();
      });
   }

   console.info(`Creating ${wgtName}...`);
   await createZip(wgtName);

   console.info(`Creating ${versionedWgtName}...`);
   await createZip(versionedWgtName);
}

const build = gulp.series(clean, updateVersion, copyFiles);
const buildPackage = gulp.series(clean, updateVersion, copyFiles, packageWgt);
const buildES5 = gulp.series(clean, updateVersion, copyFilesES5);
const buildPackageES5 = gulp.series(
   clean,
   updateVersion,
   copyFilesES5,
   packageWgt
);

export {
   clean,
   updateVersion,
   copyFiles,
   copyFilesES5,
   packageWgt,
   buildPackage,
   buildES5,
   buildPackageES5,
};
export default build;

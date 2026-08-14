const fs=require("fs");const target=`${__dirname}/../src/app/compare/page.tsx`;const c=process.argv[2];fs.writeFileSync(target,c,"utf8");console.log("written",target,c.length);

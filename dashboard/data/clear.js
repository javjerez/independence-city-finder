const fs = require("fs");

const data = JSON.parse(
  fs.readFileSync("columns_dataset.json", "utf8")
);

fs.writeFileSync(
  "pretty_columns_dataset.json",
  JSON.stringify(data, null, 2)
);
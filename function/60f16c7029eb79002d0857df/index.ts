import * as Bucket from "@spica-devkit/bucket";
const XLSX = require("xlsx");
const fetch = require("node-fetch");

/* 
 - Headers of file must be same as bucket schema properties.
 - Function excelImport will be executed after every INSERT request to Bucket Import Templates bucket.
 - If you want to use it, you only need to add an entry to the Bucket Import Template
*/

Bucket.initialize({ apikey: process.env.AUTH_APIKEY });

export async function excelImport(change) {
    let promises = [];
    let result = false;
    let schema = await Bucket.get(change.current.bucket_id).catch(e => {
        return res.status(400).send({ message: e });
    });

    await fetch(change.current.file)
        .then(function(res) {
            // get the data as a Blob
            if (!res.ok) throw new Error("fetch failed");
            return res.arrayBuffer();
        })
        .then(async function(ab) {
            // parse the data when it is received
            var data = new Uint8Array(ab);
            var workbook = XLSX.read(data, {
                type: "array"
            });
            var first_sheet_name = workbook.SheetNames[0];

            // Get worksheet
            var worksheet = workbook.Sheets[first_sheet_name];
            // Convert to json
            var _JsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
            console.log("_JsonData : ", _JsonData);
            // Import data to bucket
            _JsonData.forEach(entry => {
                //--------- covertion type
                let dataKeys = Object.keys(entry);
                dataKeys.forEach(key => {
                    if (schema.properties[key]) {
                        entry[key] = typeConverter(entry[key], schema.properties[key].type);
                    }
                });
                //--------
                promises.push(Bucket.data.insert(change.current.bucket_id, entry));
            });
            await Promise.all(promises)
                .then(data => {
                    result = true;
                    console.log("PROMISES INSERT DONE :", data);
                })
                .catch(e => {
                    result = false;
                    console.log("SOMETHING WENT WRONG WHEN INSERT", e);
                });

            return result;
        });
}

function typeConverter(data, type) {
    switch (type) {
        case "string":
            data = data.toString();
            break;
        case "number":
            data = Number(data);
            break;
        case "boolean":
            data = data.toString().toLowerCase() == "true" ? true : false;
            break;
        case "date":
            data = new Date(data).toISOString();
            break;
    }
    return data;
}

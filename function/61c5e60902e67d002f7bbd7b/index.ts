import {database} from "@spica-devkit/database";
let db;
export default async function (req, res) {
	if(!db) db =  await database();
	const colls = db.listCollections.toArray()
	return res.status(201).send(colls.map(c => c.name ));
}
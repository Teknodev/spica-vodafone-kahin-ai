import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_BUCKET = VARIABLE.BUCKET.USER;
const CONTACT_MESSAGE = VARIABLE.BUCKET.CONTACT_MESSAGE;

export async function onContactMessageInserted(change) {
    addingMsisdn(change);
}

async function addingMsisdn(change) {
	const Bucket = Api.useBucket();
	const Identity = Api.useIdentity();

    const contact_message = change.current;
    const identity = await Bucket.data.get(USER_BUCKET, contact_message.user).then((res) => res.identity);
    const msisdn = await Identity.get(identity).then((res) => res.attributes.msisdn);
    await Bucket.data.patch(CONTACT_MESSAGE, contact_message._id, { msisdn });
}
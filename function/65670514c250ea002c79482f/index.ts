import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as User from "../../63b6a403ebfd83002c5e104e/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const NOTIFICATION_LOG_BUCKET = VARIABLE.BUCKET.NOTIFICATION_LOG;

const NOTIFICATION = {
    SUBSCRIPTION_CREATED: "SubscriptionCreated",
    CREATE_SUBSCRIPTION_FAILED: "CreateSubscriptionFailed",
    SUBSCRIPTION_SUSPENDED: "SubscriptionSuspended",
    SUBSCRIPTION_RESUMED: "SubscriptionResumed",
    SUBSCRIPTION_RENEWED: "SubscriptionRenewed",
    SUBSCRIPTION_WILL_BE_DEACTIVATED: "SubscriptionWillBeDeactivated",
    SUBSCRIPTION_DEACTIVATED: "SubscriptionDeactivated",
    SUBSCRIPTION_DEACTIVATION_FAILED: "SubscriptionDeactivationFailed",
    ADVANCE_CHARGING_SUCCESSFUL: "AdvanceChargingSuccessful"
}

const SUBSCRIPTION_NOTIFICATIONS = [
    NOTIFICATION.SUBSCRIPTION_CREATED,
    NOTIFICATION.CREATE_SUBSCRIPTION_FAILED,
    NOTIFICATION.SUBSCRIPTION_SUSPENDED,
    NOTIFICATION.SUBSCRIPTION_RESUMED,
    NOTIFICATION.SUBSCRIPTION_RENEWED,
    NOTIFICATION.SUBSCRIPTION_WILL_BE_DEACTIVATED,
    NOTIFICATION.SUBSCRIPTION_DEACTIVATED,
    NOTIFICATION.SUBSCRIPTION_DEACTIVATION_FAILED,
]

export async function serviceListener(req, res) {
    const body = req.body
    const notification = body.notification;
    console.log(body)

    if (!SUBSCRIPTION_NOTIFICATIONS.includes(notification)) {
        nonSubscriptionNotification(body);
        return "ok";
    }

    const msisdn = body.params.msisdn;

    insertNotificationLog(body, msisdn);

    const user = await User.getByMsisdn(msisdn); // !TODO Change msisdn
    if (!user) {
        console.error("USER NOT FOUND: ", msisdn)
        return "ok"
    };

    const handleNotification = {
        [NOTIFICATION.SUBSCRIPTION_CREATED]: (props) => subscriptionCreated(props.msisdn, props.user, props.body),
        [NOTIFICATION.CREATE_SUBSCRIPTION_FAILED]: (props) => createSubscriptionFailed(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_SUSPENDED]: (props) => subscriptionSuspended(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_RESUMED]: (props) => subscriptionResumed(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_RENEWED]: (props) => subscriptionRenewed(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_WILL_BE_DEACTIVATED]: (props) => subscriptionWillBeDeactivated(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_DEACTIVATED]: (props) => subscriptionDeactivated(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_DEACTIVATION_FAILED]: (props) => subscriptionDeactivationFailed(props.msisdn, props.user, props.body),
    }

    handleNotification[notification]({ msisdn, user, body });

    return "ok";
}

async function subscriptionCreated(msisdn, user, body) {
    const subscription = body.params.subscription;

    await User.updateOne({ _id: user._id }, {
        $set: {
            available_play_count: 1,
            range_award: 0,
            range_point: 0,
            range_reward_count: 0,
            subscription_status: 'active',
            subscription_start_date: new Date(subscription.startDate),
            subscription_next_renewal_date: new Date(subscription.nextRenewalDate),
            subscription_last_renewal_date: new Date(subscription.lastRenewalDate),
        }
    })

    setReward(msisdn);
}

function createSubscriptionFailed(msisdn, user, body) {
    console.error("@createSubscriptionFailed: ", body)
}

async function subscriptionSuspended(msisdn, user, body) {
    const subscription = body.params.subscription;

    await User.updateOne({ _id: user._id }, {
        $set: {
            subscription_status: 'suspended',
        }
    })
}

async function subscriptionResumed(msisdn, user, body) {
    const subscription = body.params.subscription;
    // !TODO not shure about action
    await User.updateOne({ _id: user._id }, {
        $set: {
            available_play_count: 1,
            range_award: 0,
            range_reward_count: 0,
            subscription_status: 'active',
            subscription_next_renewal_date: new Date(subscription.nextRenewalDate),
            subscription_last_renewal_date: new Date(subscription.lastRenewalDate),
        }
    })

    // !TODO not shure about action
    setReward(msisdn);
}

async function subscriptionRenewed(msisdn, user, body) {
    const subscription = body.params.subscription;

    await User.updateOne({ _id: user._id }, {
        $set: {
            available_play_count: 1,
            range_award: 0,
            range_point: 0,
            range_reward_count: 0,
            subscription_status: 'active',
            subscription_next_renewal_date: new Date(subscription.nextRenewalDate),
            subscription_last_renewal_date: new Date(subscription.lastRenewalDate),
        }
    })

    setReward(msisdn);
}

function subscriptionWillBeDeactivated(msisdn, user, body) {
    console.error("@subscriptionWillBeDeactivated: ", body)
    // TODO
}

async function subscriptionDeactivated(msisdn, user, body) {
    const subscription = body.params.subscription;

    await User.updateOne({ _id: user._id }, {
        $set: {
            subscription_status: 'deactivated',
            subscription_end_date: new Date(),
        }
    })
}

function subscriptionDeactivationFailed(msisdn, user, body) {
    console.error("@subscriptionDeactivationFailed: ", body)
}

function nonSubscriptionNotification(body) {
    const notification = body.notification;
    let msisdn = "0000";

    switch (notification) {
        case NOTIFICATION.ADVANCE_CHARGING_SUCCESSFUL:
            msisdn = body.params.charging.chargedMsisdn;
            break;
    }

    insertNotificationLog(body, msisdn);
}

async function setReward() { }

function insertNotificationLog(body, msisdn) {
    Api.insertOne(NOTIFICATION_LOG_BUCKET, {
        msisdn,
        notification: body.notification,
        notification_key: body.notificationKey,
        created_at: new Date(),
        body: JSON.stringify(body)
    })
}
export function getStartDate() {
    let started_at = new Date();
    started_at.setSeconds(started_at.getSeconds() + 5);

    return JSON.stringify(started_at.toISOString());
}

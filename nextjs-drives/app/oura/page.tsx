export const metadata = {
  title: "Personal Health Archive",
  description: "A private, single-user health data backup application.",
};

export default function OuraAboutPage() {
  return (
    <>
      <p style={{ color: "#607086", fontWeight: 700, textTransform: "uppercase" }}>
        Personal project
      </p>
      <h1>Personal Health Archive</h1>
      <p>
        Personal Health Archive is a private, single-user application that securely
        retrieves authorized health and wellness records for personal backup and
        review. It is not offered to the public and does not provide medical advice.
      </p>
      <p>
        Access is read-only, limited to the scopes the account owner approves, and
        can be revoked at any time through the connected account.
      </p>
    </>
  );
}

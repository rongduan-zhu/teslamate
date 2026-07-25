export const metadata = {
  title: "Privacy Policy — Personal Health Archive",
};

export default function OuraPrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Effective July 25, 2026</p>

      <h2>Purpose and scope</h2>
      <p>
        Personal Health Archive is a private, single-user application. It collects
        only health and wellness data explicitly authorized by the account owner for
        personal backup and review.
      </p>

      <h2>Storage and security</h2>
      <p>
        Authorization credentials are kept private and encrypted at rest. Stored
        records are restricted to the account owner and protected in transit. Data is
        not sold, advertised against, or made available to other users.
      </p>

      <h2>AI use</h2>
      <p>
        Data obtained through a provider API is not supplied to an artificial
        intelligence service unless the provider expressly permits that access
        through an approved integration.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Records are retained only while needed for the personal archive. The account
        owner can stop collection by revoking access in the provider account. A
        deletion request removes stored authorization credentials and provider API
        data within 72 hours.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes to this policy will be published on this page before they
        apply.
      </p>
    </>
  );
}

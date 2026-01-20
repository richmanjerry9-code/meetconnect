export default function Privacy() {
  return (
    <div className="p-6 max-w-3xl mx-auto text-gray-800">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p>
        MeetConnect respects your privacy. This policy explains how we collect, store, and use your data:
      </p>
      <ul className="list-disc ml-6 mt-3">
        <li>We collect information necessary for platform functionality, such as name, photo, phone, county, and user preferences.</li>
        <li>We do not sell or share your information with third parties for marketing or transactional purposes.</li>
        <li>Any user-generated content may be monitored and removed if it violates our policies.</li>
        <li>All data is stored securely, using encryption where applicable.</li>
        <li>You can request access, update, or deletion of your account data at any time.</li>
        <li>By using MeetConnect, you consent to the collection and use of data as described in this policy.</li>
      </ul>
      <p className="mt-4">
        For support, contact us at <a href="mailto:meetconnect.co.ke" className="text-blue-600 underline">meetconnect.co.ke</a>.
      </p>
    </div>
  );
}


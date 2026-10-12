import { useState } from 'react';
import AdminStudentRequestsPanel from '../features/student-requests/AdminStudentRequestsPanel';

export default function AdminRequests() {
  const [notice, setNotice] = useState('');

  return (
    <div className="page__inner admin-requests-page">
      <header className="admin-requests-page__intro">
        <div>
          <span>School inbox</span>
          <h2>Student and parent requests</h2>
          <p>
            Review questions, absence notices and class requests submitted through Contact school.
            Payment records and invoices are managed separately in Payments.
          </p>
        </div>
      </header>

      {notice && <output className="notice notice--success admin-requests-page__notice">{notice}</output>}

      <AdminStudentRequestsPanel onReviewed={setNotice} />
    </div>
  );
}

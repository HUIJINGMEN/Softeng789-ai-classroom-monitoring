const test = require('node:test');
const assert = require('node:assert/strict');

const modelPath = process.env.CAMPUS_MODEL_PATH;
if (!modelPath) {
  throw new Error('CAMPUS_MODEL_PATH must point to the compiled campus model.');
}

const {
  buildRoomClassesById,
  campusDeletionSubtitle,
  filterAndSortRooms,
  filterCampuses,
  filterRoomClasses,
  roomClassOfferingLabel
} = require(modelPath);

function session(id, roomId, courseOfferingId, course, offeringCode) {
  return {
    id,
    roomId,
    courseOfferingId,
    course,
    courseOfferingCode: offeringCode,
    title: course,
    room: 'Room',
    date: '2026-09-01',
    dateLabel: '1 Sept 2026',
    time: '10:00–11:00',
    startTime: '2026-09-01T10:00:00Z',
    endTime: '2026-09-01T11:00:00Z',
    enrolled: 10,
    status: 'Completed'
  };
}

const rooms = [
  { id: 'room-b', campusId: 'city', campusName: 'City', code: 'B2', name: 'Studio', capacity: 20 },
  { id: 'room-a', campusId: 'city', campusName: 'City', code: 'A1', name: 'Lecture', capacity: 80 },
  { id: 'room-c', campusId: 'city', campusName: 'City', code: 'C3', name: 'Lab', capacity: 40 }
];

test('derives unique class usage and session counts for each room', () => {
  const usage = buildRoomClassesById([
    session('s1', 'room-a', 'class-335', 'COMPSCI 335', 'COMPSCI 335 2026'),
    session('s2', 'room-a', 'class-335', 'COMPSCI 335', 'COMPSCI 335 2026'),
    session('s3', 'room-a', 'class-789', 'SOFTENG 789', 'SOFTENG 789 2026'),
    session('s4', null, 'class-ignored', 'ENGSCI 233', 'ENGSCI 233 2026'),
    session('s5', 'room-b', null, 'ENGSCI 233', null)
  ]);

  assert.deepEqual(usage.get('room-a'), [
    {
      courseOfferingId: 'class-335',
      course: 'COMPSCI 335',
      offeringCode: 'COMPSCI 335 2026',
      sessionCount: 2
    },
    {
      courseOfferingId: 'class-789',
      course: 'SOFTENG 789',
      offeringCode: 'SOFTENG 789 2026',
      sessionCount: 1
    }
  ]);
  assert.equal(usage.has('room-b'), false);
});

test('filters rooms by room fields or scheduled class and preserves requested sorting', () => {
  const usage = buildRoomClassesById([
    session('s1', 'room-b', 'class-233', 'ENGSCI 233', 'ENGSCI 233 2026'),
    session('s2', 'room-a', 'class-335', 'COMPSCI 335', 'COMPSCI 335 2026'),
    session('s3', 'room-a', 'class-789', 'SOFTENG 789', 'SOFTENG 789 2026')
  ]);

  assert.deepEqual(
    filterAndSortRooms(rooms, usage, 'COMPSCI', { key: 'room', dir: 1 }).map((room) => room.id),
    ['room-a']
  );
  assert.deepEqual(
    filterAndSortRooms(rooms, usage, '', { key: 'capacity', dir: -1 }).map((room) => room.id),
    ['room-a', 'room-c', 'room-b']
  );
  assert.deepEqual(
    filterAndSortRooms(rooms, usage, '', { key: 'classes', dir: -1 }).map((room) => room.id),
    ['room-a', 'room-b', 'room-c']
  );
});

test('keeps campus and room-class search helpers presentation independent', () => {
  assert.deepEqual(
    filterCampuses(
      [
        { id: 'city', name: 'City', roomCount: 2 },
        { id: 'north', name: 'North', roomCount: 0 }
      ],
      'nor'
    ).map((campus) => campus.id),
    ['north']
  );

  const entries = [
    { courseOfferingId: '1', course: 'COMPSCI 335', offeringCode: 'COMPSCI 335 2026', sessionCount: 2 },
    { courseOfferingId: '2', course: 'ENGSCI 233', offeringCode: 'Engineering Studio', sessionCount: 1 }
  ];
  assert.deepEqual(filterRoomClasses(entries, 'studio').map((entry) => entry.courseOfferingId), ['2']);
  assert.equal(roomClassOfferingLabel(entries[0]), '2026');
  assert.equal(roomClassOfferingLabel(entries[1]), 'Engineering Studio');
  assert.equal(
    campusDeletionSubtitle({ id: 'north', name: 'North', roomCount: 0 }),
    'North has no rooms and can be safely removed.'
  );
});


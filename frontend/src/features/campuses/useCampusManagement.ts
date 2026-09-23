import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Console } from '../../hooks/useConsole';
import { apiMessage } from '../../lib/apiClient';
import {
  createCampus,
  deleteCampus,
  listCampuses,
  updateCampus,
  type CampusApiResponse
} from '../../lib/campusApi';
import {
  createRoom,
  deleteRoom,
  listRooms,
  updateRoom,
  type RoomApiResponse
} from '../../lib/roomApi';
import { usePagination, useSort } from '../../lib/table';
import {
  buildRoomClassesById,
  filterAndSortRooms,
  filterCampuses,
  filterRoomClasses,
  type RoomClassUsage,
  type RoomSortKey
} from './campusModel';

type CampusConsole = Pick<
  Console,
  'sessions' | 'setClassFocusId' | 'setPage' | 'showToast'
>;

export interface RoomInput {
  campusId: string;
  code: string;
  name: string;
  capacity: number;
}

/** Data, mutations and transient workflow state for the campus administration workspace. */
export function useCampusManagement(console: CampusConsole) {
  const [campuses, setCampuses] = useState<CampusApiResponse[]>([]);
  const [rooms, setRooms] = useState<RoomApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedCampusId, setSelectedCampusId] = useState('');
  const [campusQuery, setCampusQuery] = useState('');
  const [roomQuery, setRoomQuery] = useState('');
  const [campusPage, setCampusPage] = useState(0);
  const [roomPage, setRoomPage] = useState(0);
  const [creatingCampus, setCreatingCampus] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [editingCampus, setEditingCampus] = useState<CampusApiResponse | null>(null);
  const [editingRoom, setEditingRoom] = useState<RoomApiResponse | null>(null);
  const [deletingCampus, setDeletingCampus] = useState<CampusApiResponse | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<RoomApiResponse | null>(null);
  const [viewingClassesForRoom, setViewingClassesForRoom] = useState<RoomApiResponse | null>(null);
  const [roomClassQuery, setRoomClassQuery] = useState('');
  const [roomClassPage, setRoomClassPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const refreshRequestRef = useRef(0);
  const { sort: roomSort, toggle: toggleRoomSort } = useSort<RoomSortKey>('room');

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestRef.current;
    setLoading(true);
    try {
      const [campusResult, roomResult] = await Promise.all([listCampuses(), listRooms()]);
      if (requestId !== refreshRequestRef.current) return;
      setCampuses(campusResult);
      setRooms(roomResult);
      setSelectedCampusId((current) =>
        current && campusResult.some((campus) => campus.id === current)
          ? current
          : campusResult[0]?.id || ''
      );
      setListError('');
    } catch (error) {
      if (requestId === refreshRequestRef.current) setListError(apiMessage(error));
    } finally {
      if (requestId === refreshRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      refreshRequestRef.current += 1;
    };
  }, [refresh]);

  const selectedCampus = campuses.find((campus) => campus.id === selectedCampusId);
  const filteredCampuses = useMemo(
    () => filterCampuses(campuses, campusQuery),
    [campusQuery, campuses]
  );
  const roomsAtSelectedCampus = useMemo(
    () => rooms.filter((room) => room.campusId === selectedCampusId),
    [rooms, selectedCampusId]
  );
  const roomClassesById = useMemo(
    () => buildRoomClassesById(console.sessions),
    [console.sessions]
  );
  const sortedRooms = useMemo(
    () => filterAndSortRooms(roomsAtSelectedCampus, roomClassesById, roomQuery, roomSort),
    [roomClassesById, roomQuery, roomSort, roomsAtSelectedCampus]
  );
  const pagedCampuses = usePagination(filteredCampuses, campusPage, setCampusPage, 7);
  const pagedRooms = usePagination(sortedRooms, roomPage, setRoomPage, 8);
  const selectedCampusCapacity = useMemo(
    () => roomsAtSelectedCampus.reduce((total, room) => total + room.capacity, 0),
    [roomsAtSelectedCampus]
  );
  const selectedCampusClassCount = useMemo(
    () =>
      new Set(
        roomsAtSelectedCampus.flatMap((room) =>
          (roomClassesById.get(room.id) ?? []).map((entry) => entry.courseOfferingId)
        )
      ).size,
    [roomClassesById, roomsAtSelectedCampus]
  );
  const campusCapacityById = useMemo(() => {
    const totals = new Map<string, number>();
    for (const room of rooms) {
      totals.set(room.campusId, (totals.get(room.campusId) ?? 0) + room.capacity);
    }
    return totals;
  }, [rooms]);

  useEffect(() => setCampusPage(0), [campusQuery]);
  useEffect(() => setRoomPage(0), [roomQuery, selectedCampusId]);

  const classesForViewedRoom = useMemo(
    () => (viewingClassesForRoom ? roomClassesById.get(viewingClassesForRoom.id) ?? [] : []),
    [roomClassesById, viewingClassesForRoom]
  );
  const filteredClassesForViewedRoom = useMemo(
    () => filterRoomClasses(classesForViewedRoom, roomClassQuery),
    [classesForViewedRoom, roomClassQuery]
  );
  const pagedRoomClasses = usePagination(
    filteredClassesForViewedRoom,
    roomClassPage,
    setRoomClassPage,
    5
  );

  useEffect(() => setRoomClassPage(0), [roomClassQuery, viewingClassesForRoom?.id]);
  useEffect(() => {
    setViewingClassesForRoom(null);
    setRoomClassQuery('');
  }, [roomPage, roomQuery, selectedCampusId, roomSort.key, roomSort.dir]);

  const selectCampus = (campusId: string) => {
    setSelectedCampusId(campusId);
    setRoomQuery('');
    setRoomPage(0);
  };
  const handleRoomSort = (key: RoomSortKey) => {
    toggleRoomSort(key);
    setRoomPage(0);
  };
  const classesAtRoom = (roomId: string) => roomClassesById.get(roomId) ?? [];
  const openRoomClasses = (room: RoomApiResponse) => {
    setViewingClassesForRoom(room);
    setRoomClassQuery('');
    setRoomClassPage(0);
  };
  const openClass = (entry: RoomClassUsage) => {
    setViewingClassesForRoom(null);
    console.setClassFocusId(entry.courseOfferingId);
    console.setPage('classes');
  };

  const handleCreateCampus = async (name: string) => {
    setSaving(true);
    try {
      const created = await createCampus(name);
      await refresh();
      setSelectedCampusId(created.id);
      return true;
    } catch (error) {
      console.showToast(`Campus was not created: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCampus = async (id: string, name: string) => {
    setSaving(true);
    try {
      await updateCampus(id, name);
      await refresh();
      return true;
    } catch (error) {
      console.showToast(`Campus was not renamed: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCampus = async () => {
    if (!deletingCampus) return;
    setSaving(true);
    try {
      await deleteCampus(deletingCampus.id);
      setDeletingCampus(null);
      await refresh();
    } catch (error) {
      console.showToast(`Campus was not deleted: ${apiMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRoom = async (payload: RoomInput) => {
    setSaving(true);
    try {
      await createRoom(payload);
      await refresh();
      return true;
    } catch (error) {
      console.showToast(`Room was not created: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoom = async (id: string, payload: RoomInput) => {
    setSaving(true);
    try {
      await updateRoom(id, payload);
      await refresh();
      return true;
    } catch (error) {
      console.showToast(`Room was not saved: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;
    setSaving(true);
    try {
      await deleteRoom(deletingRoom.id);
      setDeletingRoom(null);
      await refresh();
    } catch (error) {
      console.showToast(`Room was not deleted: ${apiMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return {
    campuses,
    rooms,
    loading,
    listError,
    refresh,
    selectedCampus,
    filteredCampuses,
    roomsAtSelectedCampus,
    sortedRooms,
    filteredRooms: sortedRooms,
    roomClassesById,
    classesAtRoom,
    campusCapacityById,
    selectedCampusCapacity,
    selectedCampusClassCount,
    campusQuery,
    setCampusQuery,
    roomQuery,
    setRoomQuery,
    selectCampus,
    roomSort,
    handleRoomSort,
    pagedCampuses,
    pagedRooms,
    creatingCampus,
    setCreatingCampus,
    creatingRoom,
    setCreatingRoom,
    editingCampus,
    setEditingCampus,
    editingRoom,
    setEditingRoom,
    deletingCampus,
    setDeletingCampus,
    deletingRoom,
    setDeletingRoom,
    viewingClassesForRoom,
    setViewingClassesForRoom,
    roomClassQuery,
    setRoomClassQuery,
    classesForViewedRoom,
    filteredClassesForViewedRoom,
    pagedRoomClasses,
    openRoomClasses,
    openClass,
    saving,
    handleCreateCampus,
    handleUpdateCampus,
    handleDeleteCampus,
    handleCreateRoom,
    handleUpdateRoom,
    handleDeleteRoom
  };
}

export type CampusManagement = ReturnType<typeof useCampusManagement>;

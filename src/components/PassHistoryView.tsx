import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Bath,
  Building2,
  HeartPulse,
  UserCheck,
  DoorOpen,
  BookOpen,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { HallPass, DestinationType, Teacher } from '../types';
import { DESTINATION_LIST, formatElapsedTime, formatTimeAmPm, formatDateShort } from '../lib/constants';

interface PassHistoryViewProps {
  allPasses: HallPass[];
  teachers: Teacher[];
}

export const PassHistoryView: React.FC<PassHistoryViewProps> = ({
  allPasses,
  teachers
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDestination, setFilterDestination] = useState<string>('ALL');
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<string>('ALL'); // 'TODAY' | 'WEEK' | 'MONTH' | 'ALL'
  const [filterStatus, setFilterStatus] = useState<string>('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

  // Filter computation
  const filteredPasses = allPasses.filter((pass) => {
    // 1. Search Query
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      pass.studentName.toLowerCase().includes(q) ||
      pass.studentId.includes(q) ||
      pass.teacher.toLowerCase().includes(q) ||
      (pass.destinationDetails && pass.destinationDetails.toLowerCase().includes(q));

    // 2. Destination
    const matchesDest = filterDestination === 'ALL' || pass.destination === filterDestination;

    // 3. Teacher
    const matchesTeacher = filterTeacher === 'ALL' || pass.teacher === filterTeacher;

    // 4. Status
    const matchesStatus = filterStatus === 'ALL' || pass.status === filterStatus;

    // 5. Date Range
    let matchesDate = true;
    const now = Date.now();
    if (filterDateRange === 'TODAY') {
      matchesDate = new Date(pass.timeOut).toDateString() === new Date().toDateString();
    } else if (filterDateRange === 'WEEK') {
      matchesDate = now - pass.timeOut <= 7 * 24 * 60 * 60 * 1000;
    } else if (filterDateRange === 'MONTH') {
      matchesDate = now - pass.timeOut <= 30 * 24 * 60 * 60 * 1000;
    }

    return matchesSearch && matchesDest && matchesTeacher && matchesStatus && matchesDate;
  });

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Pass ID',
      'Student Name',
      'Student ID',
      'Destination',
      'Destination Notes',
      'Authorizing Teacher',
      'Status',
      'Date',
      'Time Out',
      'Time In',
      'Duration (Minutes)',
      'Created By'
    ];

    const rows = filteredPasses.map((p) => [
      `"${p.id}"`,
      `"${p.studentName}"`,
      `"${p.studentId}"`,
      `"${p.destination}"`,
      `"${(p.destinationDetails || '').replace(/"/g, '""')}"`,
      `"${p.teacher}"`,
      `"${p.status}"`,
      `"${formatDateShort(p.timeOut)}"`,
      `"${formatTimeAmPm(p.timeOut)}"`,
      `"${p.timeIn ? formatTimeAmPm(p.timeIn) : 'Active'}"`,
      `"${p.durationMinutes || (p.status === 'ACTIVE' ? 'Active' : '')}"`,
      `"${p.createdBy}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `JMMS_HallPass_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDestinationIcon = (dest: DestinationType) => {
    switch (dest) {
      case 'Restroom': return <Bath className="w-4 h-4" />;
      case 'Office': return <Building2 className="w-4 h-4" />;
      case 'Nurse': return <HeartPulse className="w-4 h-4" />;
      case 'Counselor': return <UserCheck className="w-4 h-4" />;
      case 'Another Classroom': return <DoorOpen className="w-4 h-4" />;
      case 'Library': return <BookOpen className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl border-2 border-amber-400/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-amber-400 text-purple-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              School Audit Trail
            </span>
            <span className="text-xs text-purple-200">
              Cloud Firestore Log
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-center gap-2">
            <History className="w-7 h-7 text-amber-400" />
            Jackson Memorial Pass History
          </h2>
          <p className="text-xs sm:text-sm text-purple-200 mt-0.5">
            Searchable log of all active and completed hall passes across 8th grade.
          </p>
        </div>

        <button
          id="btn-export-csv"
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-purple-950 font-black text-xs sm:text-sm rounded-xl shadow-lg flex items-center gap-2 transition transform active:scale-95 border border-amber-200"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export CSV Log ({filteredPasses.length})</span>
        </button>
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search input */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-history-search"
              type="text"
              placeholder="Search student, teacher, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:border-purple-600"
            />
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:border-purple-600 outline-none"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today Only</option>
              <option value="WEEK">Past 7 Days</option>
              <option value="MONTH">Past 30 Days</option>
            </select>
          </div>

          {/* Destination Filter */}
          <div>
            <select
              value={filterDestination}
              onChange={(e) => setFilterDestination(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:border-purple-600 outline-none"
            >
              <option value="ALL">All Destinations</option>
              {DESTINATION_LIST.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Teacher Filter */}
          <div>
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:border-purple-600 outline-none"
            >
              <option value="ALL">All Teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Showing <strong className="text-purple-950">{filteredPasses.length}</strong> of {allPasses.length} records</span>
          {(searchQuery || filterDestination !== 'ALL' || filterTeacher !== 'ALL' || filterDateRange !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterDestination('ALL');
                setFilterTeacher('ALL');
                setFilterDateRange('ALL');
              }}
              className="text-purple-700 hover:text-purple-900 font-bold underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        {filteredPasses.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <History className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-700">No pass logs match your criteria.</p>
            <p className="text-xs text-slate-400 mt-0.5">Try clearing filters or search term.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Destination</th>
                  <th className="py-3.5 px-4">Authorizing Teacher</th>
                  <th className="py-3.5 px-4">Date & Time Out</th>
                  <th className="py-3.5 px-4">Time In</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPasses.map((pass) => (
                  <tr key={pass.id} className="hover:bg-purple-50/40 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>
                        <span>{pass.studentName}</span>
                        <span className="block text-[11px] font-mono text-slate-400">#{pass.studentId}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span className="p-1 rounded bg-purple-50 text-purple-900">
                          {getDestinationIcon(pass.destination)}
                        </span>
                        <span>{pass.destination}</span>
                      </div>
                      {pass.destinationDetails && (
                        <span className="text-[11px] text-slate-500 italic block mt-0.5 max-w-[200px] truncate">
                          "{pass.destinationDetails}"
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-700">
                      {pass.teacher}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      <div>{formatDateShort(pass.timeOut)}</div>
                      <div className="text-[11px] text-slate-400">{formatTimeAmPm(pass.timeOut)}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {pass.timeIn ? (
                        <div>
                          <div>{formatDateShort(pass.timeIn)}</div>
                          <div className="text-[11px] text-slate-400">{formatTimeAmPm(pass.timeIn)}</div>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-bold">Currently Out</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-purple-950">
                      {pass.status === 'ACTIVE' 
                        ? formatElapsedTime(pass.timeOut)
                        : `${pass.durationMinutes || 4} min`}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        pass.status === 'ACTIVE'
                          ? 'bg-amber-100 text-amber-900 animate-pulse'
                          : pass.status === 'CANCELLED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {pass.status === 'ACTIVE' ? 'Active Out' : pass.status === 'CANCELLED' ? 'Cancelled' : 'Completed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

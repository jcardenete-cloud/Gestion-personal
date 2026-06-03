import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../api';
import { formatDate } from '../utils';
import { Briefcase, Users, CheckCircle, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';

const StatCard = ({ icon: Icon, title, value, color, subValues }) => (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
        <div style={{ background: color, padding: '1rem', borderRadius: '12px', color: 'white' }}>
            <Icon size={24} />
        </div>
        <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{title}</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</h3>
            {subValues && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                    {subValues.map((sv, idx) => (
                        <span key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: sv.highlight ? '2px 8px' : '0',
                            backgroundColor: sv.highlight ? `${color}20` : 'transparent',
                            borderRadius: '6px',
                            border: sv.highlight ? `1px solid ${color}40` : 'none',
                            color: sv.highlight ? color : 'var(--text-muted)'
                        }}>
                            {sv.label}: <strong style={{ color: sv.highlight ? color : 'var(--text-main)', fontSize: sv.highlight ? '0.95rem' : '0.85rem', fontWeight: sv.highlight ? '800' : '600' }}>{sv.value}</strong>
                        </span>
                    ))}
                </div>
            )}
        </div>
    </div>
);

const Custom3DBar = (props) => {
    const { x, y, width, height, fill } = props;
    if (height === 0 || !height) return null;

    const depth = 6;
    return (
        <g>
            {/* Sombra proyectada */}
            <rect x={x + 2} y={y + 2} width={width} height={height} fill="rgba(0,0,0,0.05)" />
            {/* Lado derecho (profundidad) */}
            <path
                d={`M ${x + width},${y} L ${x + width + depth},${y - depth} L ${x + width + depth},${y + height - depth} L ${x + width},${y + height} Z`}
                fill={fill}
                fillOpacity={0.3}
                style={{ filter: 'brightness(0.7)' }}
            />
            {/* Cara superior (profundidad) */}
            <path
                d={`M ${x},${y} L ${x + depth},${y - depth} L ${x + width + depth},${y - depth} L ${x + width},${y} Z`}
                fill={fill}
                fillOpacity={0.5}
                style={{ filter: 'brightness(1.2)' }}
            />
            {/* Cara frontal */}
            <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.4} stroke={fill} strokeWidth={0.5} />
        </g>
    );
};

const CustomXAxisTick = ({ x, y, payload, fontSize = 11 }) => {
    const value = payload.value || '';
    const words = value.split(' ');
    let lines = [];

    if (words.length > 2 && value.length > 12) {
        const mid = Math.ceil(words.length / 2);
        lines.push(words.slice(0, mid).join(' '));
        lines.push(words.slice(mid).join(' '));
    } else if (value.length > 14 && words.length >= 2) {
        lines.push(words[0]);
        lines.push(words.slice(1).join(' '));
    } else {
        lines.push(value);
    }

    return (
        <g transform={`translate(${x},${y})`}>
            {lines.map((line, index) => (
                <text
                    key={index}
                    x={0}
                    y={0}
                    dy={index === 0 ? 15 : 15 + (fontSize * 1.2)}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize={fontSize}
                    style={{ fontWeight: 500 }}
                >
                    {line}
                </text>
            ))}
        </g>
    );
};

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalEncargos: 0, inforS: 0, inforN: 0,
        active: 0, inactive: 0, total: 0,
        totalPresupuesto: 0, presupuestoS: 0, presupuestoN: 0
    });
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);
    const [chartColors, setChartColors] = useState([]);
    const [profileChartData, setProfileChartData] = useState([]);
    const [profileFilter, setProfileFilter] = useState('active'); // 'active', 'inactive', 'both'
    const [unassignedList, setUnassignedList] = useState([]);
    const [expiringContracts, setExpiringContracts] = useState([]);
    const [expiringEncargos, setExpiringEncargos] = useState([]);
    const [contractData, setContractData] = useState([]);
    const [yearlyChartData, setYearlyChartData] = useState([]);
    const [allPersonnel, setAllPersonnel] = useState([]);
    const [modalData, setModalData] = useState({ open: false, title: '', people: [] });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [e, pers, assigns] = await Promise.all([
                    api.getEncargos(),
                    api.getPersonal(),
                    api.getAssignments()
                ]);

                setAllPersonnel(pers.data);

                const activePersonal = pers.data.filter(p => p.ACTIVO === 'S');
                const totalActive = activePersonal.length;

                // Unique people with assignments to active encargos (FIN_REAL is null)
                const activeEncargoCodes = new Set(
                    e.data
                        .filter(enc => !enc.FIN_REAL)
                        .map(enc => (enc.CODIGOPR || '').toString().trim())
                );

                const assignedPersonIds = new Set(
                    assigns.data
                        .filter(a => !a.BAJA && activeEncargoCodes.has((a.CODIGOPR || '').toString().trim()))
                        .map(a => a.REF_PER)
                );

                // Intersection with active personal (in case there are assignments for inactive/deleted people)
                const assignedCount = activePersonal.filter(p => assignedPersonIds.has(p.REF_PER)).length;
                const unassignedCount = activePersonal.filter(p => !assignedPersonIds.has(p.REF_PER) && p.RESP === 'S').length;

                // Filter and Sort Unassigned Personal (Only Responsibles 'S')
                const unassigned = activePersonal.filter(p => !assignedPersonIds.has(p.REF_PER) && p.RESP === 'S');
                unassigned.sort((a, b) => {
                    const ap1A = (a.APELLIDO1 || '').toString().toLowerCase();
                    const ap1B = (b.APELLIDO1 || '').toString().toLowerCase();
                    if (ap1A < ap1B) return -1;
                    if (ap1A > ap1B) return 1;

                    const ap2A = (a.APELLIDO2 || '').toString().toLowerCase();
                    const ap2B = (b.APELLIDO2 || '').toString().toLowerCase();
                    if (ap2A < ap2B) return -1;
                    if (ap2A > ap2B) return 1;

                    const nA = (a.NOMBRE || '').toString().toLowerCase();
                    const nB = (b.NOMBRE || '').toString().toLowerCase();
                    if (nA < nB) return -1;
                    if (nA > nB) return 1;

                    return 0;
                });
                setUnassignedList(unassigned);

                // Prepare Expiring Contracts Data (Active only, F_CONTRATO < today + 2 months)
                const today = new Date();
                const limitDate = new Date();
                limitDate.setMonth(today.getMonth() + 2);

                const expiring = activePersonal.filter(p => {
                    if (!p.F_CONTRATO) return false;
                    const cDate = new Date(p.F_CONTRATO);
                    return !isNaN(cDate.getTime()) && cDate < limitDate && p.PLANTILLA === 'N' && p.RESP === 'S';
                });
                expiring.sort((a, b) => new Date(a.F_CONTRATO) - new Date(b.F_CONTRATO));
                setExpiringContracts(expiring);

                // Prepare Expiring Encargos Data (Not finished, FIN < today + 2 months)
                const expiringEnc = e.data.filter(enc => {
                    if (!enc.FIN || enc.FIN_REAL) return false;
                    const fDate = new Date(enc.FIN);
                    return !isNaN(fDate.getTime()) && fDate < limitDate;
                });
                expiringEnc.sort((a, b) => new Date(a.FIN) - new Date(b.FIN));
                setExpiringEncargos(expiringEnc);

                const inforSCount = e.data.filter(enc => enc.INFOR === 'S' && !enc.FIN_REAL).length;
                const inforNCount = e.data.filter(enc => (enc.INFOR === 'N' || !enc.INFOR) && !enc.FIN_REAL).length;
                const totalEncargosCount = e.data.filter(enc => !enc.FIN_REAL).length;

                const totalPresupuesto = e.data.filter(enc => !enc.FIN_REAL).reduce((acc, enc) => acc + (parseFloat(enc.PRESUPUESTO) || 0), 0);
                const presupuestoS = e.data.filter(enc => enc.INFOR === 'S' && !enc.FIN_REAL).reduce((acc, enc) => acc + (parseFloat(enc.PRESUPUESTO) || 0), 0);
                const presupuestoN = e.data.filter(enc => (enc.INFOR === 'N' || !enc.INFOR) && !enc.FIN_REAL).reduce((acc, enc) => acc + (parseFloat(enc.PRESUPUESTO) || 0), 0);

                const activeCount = pers.data.filter(p => p.ACTIVO === 'S').length;
                const inactiveCount = pers.data.filter(p => p.ACTIVO !== 'S').length;
                const totalCount = pers.data.length;

                const formatCurrency = (val) => val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

                setStats({
                    totalEncargos: totalEncargosCount,
                    inforS: inforSCount,
                    inforN: inforNCount,
                    active: activeCount,
                    inactive: inactiveCount,
                    total: totalCount,
                    totalPresupuesto: formatCurrency(totalPresupuesto),
                    presupuestoS: formatCurrency(presupuestoS),
                    presupuestoN: formatCurrency(presupuestoN)
                });

                // Prepare Contract Chart Data (Active personnel only)
                const activePersForContract = pers.data.filter(p => p.ACTIVO === 'S');
                const indefinidos = activePersForContract.filter(p => p.PLANTILLA === 'S').length;
                const eventuales = activePersForContract.filter(p => p.PLANTILLA === 'N').length;
                setContractData([
                    { name: 'Indefinidos', value: indefinidos },
                    { name: 'Eventuales', value: eventuales }
                ]);

                // Prepare Chart Data breakdown by Encargo (only active ones)
                const assignmentsByEncargo = {};
                assigns.data.filter(a => !a.BAJA).forEach(a => {
                    const assignmentCode = (a.CODIGOPR || '').toString().trim();
                    if (activeEncargoCodes.has(assignmentCode)) {
                        const person = activePersonal.find(p => p.REF_PER === a.REF_PER);
                        if (person) {
                            if (!assignmentsByEncargo[assignmentCode]) {
                                assignmentsByEncargo[assignmentCode] = 0;
                            }
                            assignmentsByEncargo[assignmentCode]++;
                        }
                    }
                });

                const data = Object.keys(assignmentsByEncargo).map(code => {
                    const encargo = e.data.find(enc => (enc.CODIGOPR || '').toString().trim() === code);
                    return {
                        name: code,
                        fullName: encargo ? `${code} - ${encargo.NOMBRE}` : code,
                        value: assignmentsByEncargo[code]
                    };
                });

                if (unassignedCount > 0) {
                    data.push({ name: 'Sin Asignar', fullName: 'Personal Sin Asignar', value: unassignedCount });
                }

                setChartData(data);

                // Prepare Profile Chart Data
                const pData = {};
                pers.data.forEach(p => {
                    const profile = p.PERFIL || 'Sin Perfil';
                    if (!pData[profile]) {
                        pData[profile] = { name: profile, Activos: 0, Inactivos: 0 };
                    }
                    if (p.ACTIVO === 'S') {
                        pData[profile].Activos++;
                    } else {
                        pData[profile].Inactivos++;
                    }
                });
                setProfileChartData(Object.values(pData).sort((a, b) => a.name.localeCompare(b.name)));

                const generateColors = (count) => {
                    const colors = [];
                    for (let i = 0; i < count; i++) {
                        if (data[i].name === 'Sin Asignar') {
                            colors.push('#94a3b8');
                        } else {
                            const hue = (i * 137.508) % 360;
                            colors.push(`hsl(${hue}, 70%, 50%)`);
                        }
                    }
                    return colors;
                };
                setChartColors(generateColors(data.length));

                // Prepare Yearly Data
                const yearMap = {};
                const currentYear = new Date().getFullYear();
                let minYearFound = currentYear;

                pers.data.forEach(p => {
                    if (p.INCORPORACION) {
                        const date = new Date(p.INCORPORACION);
                        if (!isNaN(date.getTime())) {
                            const year = date.getFullYear();
                            if (year < minYearFound) minYearFound = year;
                            if (!yearMap[year]) yearMap[year] = { year, altas: 0, bajas: 0 };
                            yearMap[year].altas++;
                        }
                    }
                    if (p.BAJA) {
                        const date = new Date(p.BAJA);
                        if (!isNaN(date.getTime())) {
                            const year = date.getFullYear();
                            if (year < minYearFound) minYearFound = year;
                            if (!yearMap[year]) yearMap[year] = { year, altas: 0, bajas: 0 };
                            yearMap[year].bajas++;
                        }
                    }
                });

                const sortedYears = Object.keys(yearMap).map(Number).sort((a, b) => a - b);
                const processedYearlyData = [];
                let cumulative = 0;

                if (sortedYears.length > 0) {
                    const startYear = sortedYears[0];
                    for (let y = startYear; y <= currentYear; y++) {
                        const yd = yearMap[y] || { altas: 0, bajas: 0 };
                        cumulative += (yd.altas - yd.bajas);
                        processedYearlyData.push({
                            year: y,
                            Altas: yd.altas,
                            Bajas: yd.bajas,
                            Activos: cumulative
                        });
                    }
                }
                setYearlyChartData(processedYearlyData);
            } catch (err) {
                console.error("Error fetching stats", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleBarClick = (data, dataKey) => {
        const profileName = data.name;
        const isActiveFilter = dataKey === 'Activos';

        const filtered = allPersonnel.filter(p => {
            const pProfile = p.PERFIL || 'Sin Perfil';
            if (pProfile !== profileName) return false;
            return isActiveFilter ? p.ACTIVO === 'S' : p.ACTIVO !== 'S';
        });

        const sorted = [...filtered].sort((a, b) => {
            const ap1A = (a.APELLIDO1 || '').toString().toLowerCase();
            const ap1B = (b.APELLIDO1 || '').toString().toLowerCase();
            if (ap1A < ap1B) return -1;
            if (ap1A > ap1B) return 1;

            const ap2A = (a.APELLIDO2 || '').toString().toLowerCase();
            const ap2B = (b.APELLIDO2 || '').toString().toLowerCase();
            if (ap2A < ap2B) return -1;
            if (ap2A > ap2B) return 1;

            const nA = (a.NOMBRE || '').toString().toLowerCase();
            const nB = (b.NOMBRE || '').toString().toLowerCase();
            if (nA < nB) return -1;
            if (nA > nB) return 1;

            return 0;
        });

        setModalData({
            open: true,
            title: `Personal: ${profileName} (${isActiveFilter ? 'Activos' : 'Inactivos'})`,
            people: sorted
        });
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Cuadro de Mandos</h2>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard
                    icon={Briefcase}
                    title="Resumen Encargos"
                    value={`Presupuesto: ${stats.totalPresupuesto}`}
                    color="#6366f1"
                    subValues={[
                        { label: 'Total Cant.', value: stats.totalEncargos },
                        { label: 'G. Directa S', value: `${stats.inforS} (${stats.presupuestoS})` },
                        { label: 'G. Directa N', value: `${stats.inforN} (${stats.presupuestoN})` }
                    ]}
                />
                <StatCard
                    icon={Users}
                    title="Resumen de Personal"
                    value={`Activos: ${stats.active}`}
                    color="#10b981"
                    subValues={[
                        { label: 'Total', value: stats.total },
                        { label: 'Inactivos', value: stats.inactive }
                    ]}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ height: '400px' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Personal Sin Asignar ({unassignedList.length})</h3>
                    <div style={{ height: 'calc(100% - 3rem)', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-card)', textAlign: 'left', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '1rem' }}>Personal</th>
                                    <th style={{ padding: '1rem' }}>Perfil</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unassignedList.map((p) => (
                                    <tr key={p.REF_PER} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                                            {p.APELLIDO1} {p.APELLIDO2}, {p.NOMBRE}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.PERFIL || '-'}</td>
                                    </tr>
                                ))}
                                {unassignedList.length === 0 && (
                                    <tr>
                                        <td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            Todo el personal activo tiene asignaciones.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="glass-card" style={{ height: '400px' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Próximos Fin de Contrato ({expiringContracts.length})</h3>
                    <div style={{ height: 'calc(100% - 3rem)', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-card)', textAlign: 'left', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '1rem' }}>Personal</th>
                                    <th style={{ padding: '1rem' }}>Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expiringContracts.map((p) => (
                                    <tr key={p.REF_PER} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                                            {p.APELLIDO1} {p.APELLIDO2 || ''}, {p.NOMBRE}
                                        </td>
                                        <td style={{ padding: '1rem', color: new Date(p.F_CONTRATO) < new Date() ? '#ef4444' : 'inherit' }}>
                                            {formatDate(p.F_CONTRATO)}
                                        </td>
                                    </tr>
                                ))}
                                {expiringContracts.length === 0 && (
                                    <tr>
                                        <td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No hay personal con fin de contrato próximo.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="glass-card" style={{ height: '400px' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Próximos Fin de Encargo ({expiringEncargos.length})</h3>
                    <div style={{ height: 'calc(100% - 3rem)', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-card)', textAlign: 'left', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '1rem' }}>Encargo</th>
                                    <th style={{ padding: '1rem' }}>Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expiringEncargos.map((enc) => (
                                    <tr key={enc.CODIGOPR} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                                            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{enc.CODIGOPR}</span> - {enc.NOMBRE}
                                        </td>
                                        <td style={{ padding: '1rem', color: new Date(enc.FIN) < new Date() ? '#ef4444' : 'inherit' }}>
                                            {formatDate(enc.FIN)}
                                        </td>
                                    </tr>
                                ))}
                                {expiringEncargos.length === 0 && (
                                    <tr>
                                        <td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No hay encargos con fin próximo.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ height: '400px', marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Estado de Asignaciones</h3>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Cargando...</div>
                ) : (
                    <ResponsiveContainer width="100%" height="90%" minWidth={0}>
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="var(--text-muted)"
                                interval={0}
                                height={60}
                                tick={<CustomXAxisTick fontSize={11} />}
                            />
                            <YAxis stroke="var(--text-muted)" fontSize={13} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-card)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--text-main)' }}
                                labelFormatter={(label, payload) => {
                                    if (payload && payload[0]) return payload[0].payload.fullName || label;
                                    return label;
                                }}
                            />
                            <Bar dataKey="value" shape={<Custom3DBar />}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="glass-card" style={{ width: '100%', height: '400px', marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Evolución Histórica de Personal</h3>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Cargando...</div>
                ) : (
                    <ResponsiveContainer width="100%" height="90%" minWidth={0}>
                        <LineChart data={yearlyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                            <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={12} />
                            <YAxis stroke="var(--text-muted)" fontSize={12} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-card)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--text-main)' }}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Line type="monotone" dataKey="Altas" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Bajas" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Activos" stroke="#6366f1" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ flex: '0 0 78%', height: '550px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Personal por Perfil (3D)</h3>
                        <div className="glass-card" style={{ padding: '0.4rem', display: 'flex', gap: '0.5rem', borderRadius: '10px' }}>
                            <button
                                onClick={() => setProfileFilter('active')}
                                className={`btn ${profileFilter === 'active' ? 'btn-primary' : ''}`}
                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', background: profileFilter === 'active' ? '' : 'transparent', color: profileFilter === 'active' ? '' : 'var(--text-muted)' }}
                            >
                                Solo Activos
                            </button>
                            <button
                                onClick={() => setProfileFilter('inactive')}
                                className={`btn ${profileFilter === 'inactive' ? 'btn-primary' : ''}`}
                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', background: profileFilter === 'inactive' ? '' : 'transparent', color: profileFilter === 'inactive' ? '' : 'var(--text-muted)' }}
                            >
                                Solo Inactivos
                            </button>
                            <button
                                onClick={() => setProfileFilter('both')}
                                className={`btn ${profileFilter === 'both' ? 'btn-primary' : ''}`}
                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', background: profileFilter === 'both' ? '' : 'transparent', color: profileFilter === 'both' ? '' : 'var(--text-muted)' }}
                            >
                                Ambos
                            </button>
                        </div>
                    </div>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Cargando...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="90%" minWidth={0}>
                            <BarChart
                                data={profileChartData.filter(item => {
                                    if (profileFilter === 'active') return item.Activos > 0;
                                    if (profileFilter === 'inactive') return item.Inactivos > 0;
                                    return (item.Activos + item.Inactivos) > 0;
                                })}
                                margin={{ top: 20, right: 30, left: 0, bottom: 80 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="var(--text-muted)"
                                    interval={0}
                                    height={80}
                                    tick={<CustomXAxisTick fontSize={12} />}
                                />
                                <YAxis stroke="var(--text-muted)" fontSize={13} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-card)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--text-main)' }}
                                />
                                <Legend verticalAlign="top" height={36} />
                                {(profileFilter === 'active' || profileFilter === 'both') && (
                                    <Bar
                                        dataKey="Activos"
                                        fill="#10b981"
                                        shape={<Custom3DBar />}
                                        onClick={(data) => handleBarClick(data, 'Activos')}
                                        style={{ cursor: 'pointer' }}
                                    />
                                )}
                                {(profileFilter === 'inactive' || profileFilter === 'both') && (
                                    <Bar
                                        dataKey="Inactivos"
                                        fill="#ef4444"
                                        shape={<Custom3DBar />}
                                        onClick={(data) => handleBarClick(data, 'Inactivos')}
                                        style={{ cursor: 'pointer' }}
                                    />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="glass-card" style={{ flex: '0 0 20%', height: '550px' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>Personal por Contrato</h3>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Cargando...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="80%" minWidth={0}>
                            <PieChart>
                                <defs>
                                    <linearGradient id="colorIndefinido" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.6} />
                                    </linearGradient>
                                    <linearGradient id="colorEventual" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#d97706" stopOpacity={0.6} />
                                    </linearGradient>
                                </defs>
                                <Pie
                                    data={contractData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                    labelLine={false}
                                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                        const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                        const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                        return (
                                            <text
                                                x={x}
                                                y={y}
                                                fill="white"
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                style={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                                            >
                                                {`${(percent * 100).toFixed(0)}%`}
                                            </text>
                                        );
                                    }}
                                >
                                    <Cell key="cell-0" fill="url(#colorIndefinido)" stroke="#6366f1" />
                                    <Cell key="cell-1" fill="url(#colorEventual)" stroke="#f59e0b" />
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-card)', borderRadius: '8px', fontSize: '0.8rem' }}
                                    itemStyle={{ color: 'var(--text-main)' }}
                                />
                                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '0.75rem' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Drill-down Modal */}
            {modalData.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }} onClick={() => setModalData({ ...modalData, open: false })}>
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="glass-card"
                        style={{ width: '500px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--glass2-bg)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>{modalData.title}</h3>
                            <button
                                onClick={() => setModalData({ ...modalData, open: false })}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-card)', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.8rem' }}>Personal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalData.people.map((p) => (
                                        <tr key={p.REF_PER} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '0.8rem', fontWeight: 500 }}>
                                                {p.APELLIDO1} {p.APELLIDO2}, {p.NOMBRE}
                                            </td>
                                        </tr>
                                    ))}
                                    {modalData.people.length === 0 && (
                                        <tr>
                                            <td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                No hay personal en este grupo.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default Dashboard;

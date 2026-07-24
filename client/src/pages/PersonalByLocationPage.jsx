import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api';
import { MapPin, Search } from 'lucide-react';
import { useAuth } from '../AuthContext';

const PersonalByLocationPage = () => {
    const { isReadOnly } = useAuth();
    const canManage = !isReadOnly;
    const [locations, setLocations] = useState([]);
    const [personal, setPersonal] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [filteredPersonal, setFilteredPersonal] = useState([]);
    const [selectedPeople, setSelectedPeople] = useState([]);
    const [targetLocation, setTargetLocation] = useState('');
    const [isMoving, setIsMoving] = useState(false);

    const fetchData = async () => {
        try {
            const [locRes, persRes] = await Promise.all([
                api.getUbicacion(),
                api.getPersonal()
            ]);
            setLocations(locRes.data.sort((a, b) => String(a.REF_UBI || '').localeCompare(String(b.REF_UBI || ''), undefined, { numeric: true })));
            setPersonal(persRes.data);
        } catch (err) {
            console.error("Error fetching data:", err);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        setSelectedPeople([]); // Clear selection when location changes
    }, [selectedLocation]);

    useEffect(() => {
        if (selectedLocation) {
            // Filter personal by selected location (REF_UBI)
            const filtered = personal
                .filter(p => String(p.REF_UBI) === String(selectedLocation) && p.ACTIVO === 'S')
                .sort((a, b) => {
                    const ap1A = (a.APELLIDO1 || '').toString().toLowerCase();
                    const ap1B = (b.APELLIDO1 || '').toString().toLowerCase();
                    if (ap1A < ap1B) return -1;
                    if (ap1A > ap1B) return 1;

                    const ap2A = (a.APELLIDO2 || '').toString().toLowerCase();
                    const ap2B = (b.APELLIDO2 || '').toString().toLowerCase();
                    if (ap2A < ap2B) return -1;
                    if (ap2A > ap2B) return 1;

                    const nomA = (a.NOMBRE || '').toString().toLowerCase();
                    const nomB = (b.NOMBRE || '').toString().toLowerCase();
                    return nomA.localeCompare(nomB);
                });
            setFilteredPersonal(filtered);
        } else {
            setFilteredPersonal([]);
        }
    }, [selectedLocation, personal]);

    const toggleSelectPerson = (id) => {
        if (!canManage) return;
        setSelectedPeople(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (e) => {
        if (!canManage) return;
        if (e.target.checked) {
            setSelectedPeople(filteredPersonal.map(p => p.REF_PER));
        } else {
            setSelectedPeople([]);
        }
    };

    const handleMove = async () => {
        if (!canManage) return;
        if (!targetLocation) {
            alert("Por favor, seleccione una ubicación de destino.");
            return;
        }
        if (selectedPeople.length === 0) {
            alert("Por favor, seleccione al menos una persona.");
            return;
        }

        const confirmMsg = selectedPeople.length === 1
            ? `¿Está seguro de que desea mover a esta persona a la nueva ubicación?`
            : `¿Está seguro de que desea mover ${selectedPeople.length} personas a la nueva ubicación?`;

        if (confirm(confirmMsg)) {
            setIsMoving(true);
            try {
                await api.bulkUpdatePersonalLocation(selectedPeople, targetLocation);
                await fetchData();
                setSelectedPeople([]);
                setTargetLocation('');
                alert("Ubicación actualizada correctamente.");
            } catch (err) {
                console.error("Error moving people:", err);
                alert("Error al actualizar la ubicación.");
            } finally {
                setIsMoving(false);
            }
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <MapPin /> Personal por Ubicación
                </h2>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ flex: 1, padding: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Seleccionar Ubicación:</p>
                    <div style={{ position: 'relative' }}>
                        <MapPin size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <select
                            className="form-control"
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            style={{ paddingLeft: '2.5rem', height: '42px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)' }}
                        >
                            <option value="">-- Seleccione una ubicación --</option>
                            {locations.map(loc => (
                                <option key={loc.REF_UBI} value={loc.REF_UBI}>
                                    {loc.A_LUGAR} (Ref: {loc.REF_UBI})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div style={{ flex: 2 }}></div> {/* Spacer */}
            </div>

            {selectedLocation && (
                <div className="glass-card">
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>
                        Personal en: {locations.find(l => String(l.REF_UBI) === String(selectedLocation))?.A_LUGAR || selectedLocation}
                        <span style={{ fontSize: '0.9rem', marginLeft: '1rem', color: 'var(--text-muted)' }}>
                            ({filteredPersonal.length} personas)
                        </span>
                    </h3>

                    {!canManage && (
                        <div style={{ marginBottom: '1rem', color: '#fbbf24', fontSize: '0.9rem' }}>
                            No tienes permisos para modificar la ubicación del personal.
                        </div>
                    )}

                    {filteredPersonal.length > 0 ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border-card)' }}>
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                        {selectedPeople.length} seleccionados. Mover a:
                                    </span>
                                </div>
                                <div style={{ flex: 2 }}>
                                    <select
                                        className="form-control"
                                        value={targetLocation}
                                        onChange={(e) => setTargetLocation(e.target.value)}
                                        style={{ height: '42px', fontSize: '0.9rem' }}
                                        disabled={!canManage || selectedPeople.length === 0 || isMoving}
                                    >
                                        <option value="">-- Seleccionar destino --</option>
                                        {locations
                                            .filter(l => String(l.REF_UBI) !== String(selectedLocation))
                                            .map(loc => (
                                                <option key={loc.REF_UBI} value={loc.REF_UBI}>
                                                    {loc.A_LUGAR} (Ref: {loc.REF_UBI})
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleMove}
                                    disabled={!canManage || !targetLocation || selectedPeople.length === 0 || isMoving}
                                    style={{ height: '42px', padding: '0 1.5rem' }}
                                >
                                    {isMoving ? 'Moviendo...' : 'Cambiar Ubicación'}
                                </button>
                            </div>

                            <table style={{ width: '100%', minWidth: '600px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>
                                            <input
                                                type="checkbox"
                                                onChange={handleSelectAll}
                                                checked={canManage && selectedPeople.length === filteredPersonal.length && filteredPersonal.length > 0}
                                                disabled={!canManage}
                                            />
                                        </th>
                                        <th>Apellidos</th>
                                        <th>Nombre</th>
                                        <th>Perfil</th>
                                        <th>Email/Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPersonal.map(p => (
                                        <tr key={p.REF_PER} style={{ background: selectedPeople.includes(p.REF_PER) ? 'rgba(74, 144, 226, 0.1)' : 'transparent' }}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPeople.includes(p.REF_PER)}
                                                    onChange={() => toggleSelectPerson(p.REF_PER)}
                                                    disabled={!canManage}
                                                />
                                            </td>
                                            <td onClick={() => canManage && toggleSelectPerson(p.REF_PER)} style={{ cursor: canManage ? 'pointer' : 'default' }}>{p.APELLIDO1} {p.APELLIDO2}</td>
                                            <td onClick={() => canManage && toggleSelectPerson(p.REF_PER)} style={{ cursor: canManage ? 'pointer' : 'default' }}>{p.NOMBRE}</td>
                                            <td onClick={() => canManage && toggleSelectPerson(p.REF_PER)} style={{ cursor: canManage ? 'pointer' : 'default' }}>{p.PERFIL}</td>
                                            <td onClick={() => canManage && toggleSelectPerson(p.REF_PER)} style={{ cursor: canManage ? 'pointer' : 'default' }}>{p.USUARIO}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No hay personal asignado a esta ubicación.
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default PersonalByLocationPage;

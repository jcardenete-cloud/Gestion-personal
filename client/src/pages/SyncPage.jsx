import React, { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../api';
import { Download, Upload, AlertTriangle, CheckCircle, RefreshCw, HelpCircle } from 'lucide-react';

const SyncPage = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [importDetails, setImportDetails] = useState(null);
    const [file, setFile] = useState(null);

    const dbType = localStorage.getItem('db_type') || 'oracle';
    const dbUser = localStorage.getItem('db_user') || '';

    const handleExport = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await api.exportBackup();
            const backupData = response.data;

            // Create a blob and download it
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
            const downloadAnchor = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0];
            
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `backup_${dbType}_${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            setSuccess(`Copia de seguridad de ${dbType.toUpperCase()} exportada correctamente.`);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al exportar los datos.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setSuccess(null);
            setImportDetails(null);
        }
    };

    const handleImport = async () => {
        if (!file) {
            setError('Por favor, selecciona un archivo de copia de seguridad (.json) primero.');
            return;
        }

        const confirmImport = window.confirm(
            `¡ATENCIÓN! Estás a punto de importar datos en la base de datos ${dbType.toUpperCase()}.\n\n` +
            `Este proceso ELIMINARÁ permanentemente todos los registros actuales de Personal, Encargos, Ubicaciones y Vacaciones en ${dbType.toUpperCase()} y los sustituirá por los del archivo.\n\n` +
            `¿Estás seguro de que quieres continuar?`
        );

        if (!confirmImport) return;

        setLoading(true);
        setError(null);
        setSuccess(null);
        setImportDetails(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonData = JSON.parse(event.target.result);
                
                if (!jsonData.data || typeof jsonData.data !== 'object') {
                    throw new Error('El archivo no tiene el formato de copia de seguridad correcto.');
                }

                const response = await api.importBackup(jsonData);
                setSuccess('¡Datos importados con éxito!');
                setImportDetails(response.data.inserted_counts);
                setFile(null);
                // Clear file input
                const fileInput = document.getElementById('backup-file-input');
                if (fileInput) fileInput.value = '';
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.error || err.message || 'Error al importar los datos.');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file);
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.5 }}
            style={{ maxWidth: '1000px', margin: '0 auto' }}
        >
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={24} style={{ color: 'var(--primary)' }} />
                Sincronización a Demanda (Exportar / Importar)
            </h2>

            <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--primary)' }}>
                <div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Base de datos activa actualmente:</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.4rem' }}>
                        <span style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            backgroundColor: dbType === 'postgres' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                            color: dbType === 'postgres' ? '#3b82f6' : '#f97316',
                            border: `1px solid ${dbType === 'postgres' ? '#3b82f640' : '#f9731640'}`
                        }}>
                            {dbType.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Usuario: <strong>{dbUser}</strong></span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="glass-card" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        <AlertTriangle size={18} />
                        Error
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
                </div>
            )}

            {success && (
                <div className="glass-card" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        <CheckCircle size={18} />
                        Éxito
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{success}</p>
                    
                    {importDetails && (
                        <div style={{ marginTop: '0.8rem', fontSize: '0.85rem', borderTop: '1px solid rgba(16, 185, 129, 0.2)', paddingTop: '0.8rem' }}>
                            <strong style={{ display: 'block', marginBottom: '0.4rem' }}>Resumen de registros importados:</strong>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                                <li>Ubicaciones: {importDetails.UBICACION || 0}</li>
                                <li>Encargos: {importDetails.ENCARGOS || 0}</li>
                                <li>Personal: {importDetails.LISTA_PERSONAL || 0}</li>
                                <li>Asignaciones: {importDetails.PERSONAL_PROYECTOS || 0}</li>
                                <li>Vacaciones: {importDetails.VACACIONES || 0}</li>
                                <li>Festivos: {importDetails.FESTIVOS || 0}</li>
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Export Column */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '320px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Download size={20} style={{ color: 'var(--primary)' }} />
                            1. Exportar Datos
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            Descarga toda la información actual de la base de datos activa ({dbType.toUpperCase()}) en un único archivo de copia de seguridad estructurado en formato JSON.
                        </p>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', padding: '0.8rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <strong>Tablas exportadas:</strong> UBICACION, ENCARGOS, LISTA_PERSONAL, PERSONAL_PROYECTOS, VACACIONES y FESTIVOS.
                        </div>
                    </div>
                    <button 
                        className="btn btn-primary" 
                        onClick={handleExport}
                        disabled={loading}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.8rem' }}
                    >
                        {loading ? 'Procesando...' : `Descargar Backup de ${dbType.toUpperCase()}`}
                    </button>
                </div>

                {/* Import Column */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '320px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Upload size={20} style={{ color: '#ef4444' }} />
                            2. Importar Datos
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            Sube un archivo de copia de seguridad (.json) exportado previamente para restaurar e igualar el contenido en la base de datos activa ({dbType.toUpperCase()}).
                        </p>
                        <div style={{ marginTop: '1rem' }}>
                            <input 
                                type="file" 
                                id="backup-file-input"
                                accept=".json" 
                                onChange={handleFileChange} 
                                style={{ display: 'none' }} 
                            />
                            <label 
                                htmlFor="backup-file-input" 
                                className="btn"
                                style={{ 
                                    display: 'block', 
                                    textAlign: 'center', 
                                    padding: '0.8rem', 
                                    border: '2px dashed var(--border-card)', 
                                    borderRadius: '8px', 
                                    cursor: 'pointer',
                                    backgroundColor: file ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    borderColor: file ? 'var(--primary)' : 'var(--border-card)',
                                    color: file ? 'var(--text-main)' : 'var(--text-muted)',
                                    fontSize: '0.85rem'
                                }}
                            >
                                {file ? `Archivo seleccionado: ${file.name}` : 'Seleccionar Archivo Copia (.json)'}
                            </label>
                        </div>
                    </div>
                    <button 
                        className="btn btn-danger" 
                        onClick={handleImport}
                        disabled={loading || !file}
                        style={{ 
                            width: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justify: 'center', 
                            gap: '0.5rem', 
                            padding: '0.8rem',
                            backgroundColor: file ? '#ef4444' : 'var(--border-card)',
                            cursor: file ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {loading ? 'Restaurando...' : `Reemplazar datos en ${dbType.toUpperCase()}`}
                    </button>
                </div>
            </div>

            {/* Sync Guide */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <HelpCircle size={18} style={{ color: 'var(--text-muted)' }} />
                    Guía de sincronización manual entre bases de datos:
                </h3>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    <li>Inicia sesión seleccionando la base de datos de origen (la que contiene los cambios recientes, ej. <strong>Oracle</strong>).</li>
                    <li>Ve a esta página de Sincronización y pulsa en <strong>"Descargar Backup"</strong>. Se guardará un archivo JSON en tu equipo.</li>
                    <li>Cierra sesión y vuelve a iniciarla seleccionando la base de datos destino (la que quieres actualizar, ej. <strong>Postgres</strong>).</li>
                    <li>En esta misma página, selecciona el archivo JSON descargado en el paso 2 y haz clic en <strong>"Reemplazar datos"</strong>.</li>
                    <li>¡Listo! Ambas bases de datos tendrán exactamente la misma información.</li>
                </ol>
            </div>
        </motion.div>
    );
};

export default SyncPage;

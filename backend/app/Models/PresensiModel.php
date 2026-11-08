<?php

namespace App\Models;

use CodeIgniter\Model;

class PresensiModel extends Model
{
    protected $table            = 'presensi';
    protected $primaryKey       = 'Id_presensi';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'NIM',
        'Tanggal',
        'Sesi',
        'Waktu',
        'Latitude',
        'Longitude',
        'Status',
        'Foto_wajah',
        'Keterangan',
        'Dikoreksi_oleh',
        'Status_foto',
        'Catatan_validasi',
        'Divalidasi_oleh',
        'Divalidasi_pada',
        'Akurasi_meter',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}

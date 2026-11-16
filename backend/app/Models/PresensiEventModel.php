<?php

namespace App\Models;

use CodeIgniter\Model;

class PresensiEventModel extends Model
{
    protected $table            = 'presensi_event';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'id_event',
        'nim',
        'tanggal',
        'waktu',
        'latitude',
        'longitude',
        'jarak_meter',
        'foto',
        'status',
        'keterangan',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}

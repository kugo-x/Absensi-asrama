<?php

namespace App\Models;

use CodeIgniter\Model;

class IzinModel extends Model
{
    protected $table            = 'izin';
    protected $primaryKey       = 'Id_izin';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'NIM',
        'NIM_approver',
        'Alasan',
        'Status_persetujuan',
        'File_bukti',
        'Tanggal',
        'Tanggal_approval',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}

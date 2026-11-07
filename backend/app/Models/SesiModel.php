<?php

namespace App\Models;

use CodeIgniter\Model;

class SesiModel extends Model
{
    protected $table            = 'sesi';
    protected $primaryKey       = 'Id_sesi';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'Nama',
        'Jam_mulai',
        'Jam_selesai',
        'Aktif',
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}

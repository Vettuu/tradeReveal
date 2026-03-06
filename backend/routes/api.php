<?php

use App\Http\Controllers\TradeController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', [TradeController::class, 'dashboard']);
Route::get('/trades', [TradeController::class, 'index']);
Route::post('/trades', [TradeController::class, 'store']);
Route::post('/trades/import', [TradeController::class, 'import']);

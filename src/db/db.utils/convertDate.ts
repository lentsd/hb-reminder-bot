
/** Конвертирует формат DD.MM.YYYY в YYYY-MM-DD
 * @example '05.10.2002' -> '2002-10-05'
 */
export function convertDate(originalDate: string) {
    const [day, month, year] = originalDate.split('.');
    const dateObject = new Date(`${year}-${month}-${day}`);
    
    return dateObject.toISOString().split('T')[0];
}

export class DbErrorChecker{
    isAlreadyExist(errorMessage: string){
        return errorMessage.includes('UNIQUE constraint failed');
    }
}
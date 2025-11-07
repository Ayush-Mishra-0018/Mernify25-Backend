let wrapForError=(fn)=>{
    return async function(req,res,next){
        try{
            await fn(req,res,next);
        }
        catch(e){
            return next(e)
        }
    }
}
module.exports=wrapForError;
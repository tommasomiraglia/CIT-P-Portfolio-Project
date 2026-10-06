CREATE OR REPLACE FUNCTION delete_user(p_userid INTEGER)
RETURNS VOID AS $$
BEGIN
    DELETE FROM bookmarking_title WHERE userid = p_userid;
    DELETE FROM bookmarking_person WHERE userid = p_userid;
    DELETE FROM rating_history WHERE userid = p_userid;
    DELETE FROM history WHERE userid = p_userid;
    DELETE FROM generes_user WHERE userid = p_userid;
    DELETE FROM app_user WHERE userid = p_userid;
END;
$$ LANGUAGE plpgsql;

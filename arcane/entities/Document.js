import FileEntity from './File.js?arcaneVersion=0.5.17';

class DocumentEntity extends FileEntity {
    constructor(fileName = '', tableName = 'documents') {
		super(fileName, tableName);
		return this;
	}
}

export default DocumentEntity;
